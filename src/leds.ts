import { WIDTH, HEIGHT } from './cloth';

export type LedPattern = 'steady' | 'chase' | 'rainbow-chase' | 'spectrum' | 'breathing';
export interface LedSettings {
  depth: number;
  enabled: boolean;
  playing: boolean;
  pattern: LedPattern;
  period: number;
  brightness: number;
  color: string;
  ambient: number;
  shadows: boolean;
}
export const LED_WIDTH = WIDTH + 0.13;
export const LED_HEIGHT = HEIGHT + 0.13;
// Rails sit just ahead of maximum piston extension for grazing illumination.
export const LED_DEPTH = 0.37;
export const LIGHT_GROUPS = 4;
export const ledDefaults: LedSettings = {
  depth: LED_DEPTH, enabled: true, playing: true, pattern: 'spectrum', period: 16,
  brightness: 1, color: '#ffd3a0', ambient: 0.12, shadows: true,
};
export interface LedSample { x: number; y: number; z: number; r: number; g: number; b: number; level: number; }

export function perimeterPoint(fraction: number) {
  const phase = ((fraction % 1) + 1) % 1;
  let d = phase * (LED_WIDTH + LED_HEIGHT) * 2;
  if (d < LED_WIDTH) return { x: -LED_WIDTH / 2 + d, y: LED_HEIGHT / 2, z: LED_DEPTH };
  d -= LED_WIDTH;
  if (d < LED_HEIGHT) return { x: LED_WIDTH / 2, y: LED_HEIGHT / 2 - d, z: LED_DEPTH };
  d -= LED_HEIGHT;
  if (d < LED_WIDTH) return { x: LED_WIDTH / 2 - d, y: -LED_HEIGHT / 2, z: LED_DEPTH };
  d -= LED_WIDTH;
  return { x: -LED_WIDTH / 2, y: -LED_HEIGHT / 2 + d, z: LED_DEPTH };
}

function hueRgb(hue: number) {
  const h = ((hue % 1) + 1) % 1 * 6;
  const channel = (offset: number) => Math.max(0, Math.min(1, Math.abs(((h + offset) % 6) - 3) - 1));
  return { r: channel(0), g: channel(4), b: channel(2) };
}

export class LedController {
  settings = { ...ledDefaults };
  phase = 0;
  count = 60;
  samples: LedSample[] = [];
  constructor(count = 60) { this.setCount(count); }
  setCount(count: number) {
    if (!Number.isInteger(count) || count < 12 || count > 120) throw new RangeError('LED count must be an integer from 12 to 120.');
    this.count = count;
    this.samples = Array.from({ length: count }, (_, i) => ({ ...perimeterPoint((i + .5) / count), r: 0, g: 0, b: 0, level: 0 }));
    this.update();
  }
  advance(seconds: number) {
    if (this.settings.enabled && this.settings.playing) this.phase = (this.phase + seconds / this.settings.period) % 1;
  }
  update() {
    const s = this.settings;
    const value = Number.parseInt(s.color.slice(1), 16);
    const base = { r: ((value >> 16) & 255) / 255, g: ((value >> 8) & 255) / 255, b: (value & 255) / 255 };
    this.samples.forEach((sample, i) => {
      const f = (i + .5) / this.count;
      let level = s.enabled ? s.brightness : 0;
      let rgb = base;
      if (s.pattern === 'chase' || s.pattern === 'rainbow-chase') {
        const d = Math.abs(f - this.phase), distance = Math.min(d, 1 - d);
        level *= Math.exp(-0.5 * (distance / .075) ** 2);
        if (s.pattern === 'rainbow-chase') rgb = hueRgb(this.phase);
      } else if (s.pattern === 'breathing') level *= .12 + .88 * (.5 - .5 * Math.cos(this.phase * Math.PI * 2));
      else if (s.pattern === 'spectrum') rgb = hueRgb(f - this.phase);
      Object.assign(sample, rgb, { level });
    });
    return this.samples;
  }
}
