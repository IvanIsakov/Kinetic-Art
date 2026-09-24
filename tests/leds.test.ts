import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LedController, LED_WIDTH, LED_HEIGHT, LED_DEPTH, perimeterPoint, type LedPattern } from '../src/leds';

test('every supported LED count yields distinct evenly spaced perimeter addresses', () => {
  for (let count = 12; count <= 120; count++) {
    const leds = new LedController(count);
    assert.equal(leds.samples.length, count);
    const points = new Set<string>();
    leds.samples.forEach((p, i) => {
      assert.ok(Math.abs(Math.abs(p.x) - LED_WIDTH / 2) < 1e-8 || Math.abs(Math.abs(p.y) - LED_HEIGHT / 2) < 1e-8);
      assert.ok(Math.abs(p.x) <= LED_WIDTH / 2 + 1e-8 && Math.abs(p.y) <= LED_HEIGHT / 2 + 1e-8);
      assert.equal(p.z, LED_DEPTH);
      assert.deepEqual({ x: p.x, y: p.y, z: p.z }, perimeterPoint((i + .5) / count));
      points.add(`${p.x},${p.y}`);
    });
    assert.equal(points.size, count);
  }
  for (const count of [11, 121, 12.5, NaN]) assert.throws(() => new LedController(count), RangeError);
});

test('LED playback is deterministic, pausable and preserves phase when count changes', () => {
  const leds = new LedController(); leds.settings.period = 4;
  leds.advance(1); assert.equal(leds.phase, .25);
  leds.settings.playing = false; leds.advance(1); assert.equal(leds.phase, .25);
  leds.setCount(120); assert.equal(leds.phase, .25);
  leds.settings.playing = true; leds.advance(3); assert.equal(leds.phase, 0);
  leds.settings.enabled = false; leds.advance(2); assert.equal(leds.phase, 0);
  assert.ok(leds.update().every(s => s.level === 0));
});

test('patterns produce finite bounded colors, travel and respect brightness zero', () => {
  const leds = new LedController(120);
  for (const pattern of ['steady', 'chase', 'rainbow-chase', 'spectrum', 'breathing'] as LedPattern[]) {
    leds.settings.pattern = pattern; leds.settings.brightness = 3;
    for (let i = 0; i < 30; i++) {
      leds.advance(.3);
      for (const sample of leds.update()) {
        for (const channel of [sample.r, sample.g, sample.b]) assert.ok(Number.isFinite(channel) && channel >= 0 && channel <= 1);
        assert.ok(sample.level >= 0 && sample.level <= 3);
      }
    }
    leds.settings.brightness = 0; assert.ok(leds.update().every(s => s.level === 0));
  }
  leds.settings.pattern = 'chase'; leds.settings.brightness = 1; leds.phase = .2;
  const peak = () => leds.update().reduce((best, s, i, all) => s.level > all[best].level ? i : best, 0);
  const first = peak(); leds.phase = .7; assert.notEqual(peak(), first);
  leds.settings.pattern = 'steady'; leds.settings.color = '#ff0000';
  assert.ok(leds.update().every(s => s.r === 1 && s.g === 0 && s.b === 0));
});


test('rainbow chase keeps the chase envelope and changes hue through a full cycle', () => {
  const leds = new LedController();
  for (const phase of [0, 1/3, 2/3]) {
    leds.phase = phase; leds.settings.pattern = 'chase';
    const levels = leds.update().map(s => s.level);
    leds.settings.pattern = 'rainbow-chase';
    assert.deepEqual(leds.update().map(s => s.level), levels);
    const sample = leds.samples[0];
    assert.ok((phase === 0 ? sample.r : phase === 1/3 ? sample.g : sample.b) > .99);
  }
});
