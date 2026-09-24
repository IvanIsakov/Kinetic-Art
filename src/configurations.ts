import { validFigurePosition, type FigurePosition } from './human-stencil';
export const CONFIG_KEY = 'faraway-landscapes.configurations.v1';
export interface Configuration {
  version: 1;
  humanPosition?: FigurePosition;
  controls: Record<string, string | boolean>;
  running: boolean;
  selected: number;
  time: number;
  phase: number;
  positions: number[];
  previous: number[];
  pistons: number[];
  overrides: number[];
}
export interface Library { defaultName: string | null; configs: Record<string, Configuration>; }
export interface ControlRule { type: 'checkbox' | 'number' | 'select' | 'color'; min?: number; max?: number; options?: string[]; }
export function validateConfig(value: unknown, rules: Record<string, ControlRule>): Configuration {
  const c=value as Configuration;
  if (!c || c.version!==1 || !c.controls || typeof c.running!=='boolean') throw new Error('Not a supported FARAWAY LANDSCAPES configuration.');
  for(const [id,rule] of Object.entries(rules)) {
    const v=c.controls[id];
    if(rule.type==='checkbox' ? typeof v!=='boolean' : typeof v!=='string') throw new Error(`Missing or invalid setting: ${id}`);
    if(rule.type==='number' && (!Number.isFinite(Number(v)) || Number(v)<rule.min! || Number(v)>rule.max!)) throw new Error(`Setting outside supported range: ${id}`);
    if(rule.type==='select'&&!rule.options!.includes(String(v)))throw new Error(`Unsupported setting: ${id}`);
    if(rule.type==='color'&&!/^#[0-9a-f]{6}$/i.test(String(v)))throw new Error('Invalid light color.');
  }
  if(!Number.isInteger(Number(c.controls['led-count'])))throw new Error('LED count must be a whole number.');
  const cols=Number(c.controls.columns),rows=Number(c.controls.rows),resolution=Number(c.controls.resolution);
  const vertices=(resolution+1)*(resolution*3/4+1);
  for(const [name,size,min,max] of [['positions',vertices*3,-10,10],['previous',vertices*3,-10,10],['pistons',cols*rows,0,.320001],['overrides',cols*rows,-1,.320001]] as const) {
    const a=c[name];if(!Array.isArray(a)||a.length!==size||a.some(n=>typeof n!=='number'||!Number.isFinite(n)||n<min||n>max))throw new Error(`Invalid saved ${name}.`);
  }
  if(!Number.isInteger(c.selected)||c.selected<0||c.selected>=cols*rows || !Number.isFinite(c.time)||c.time<0||c.time>1e9||!Number.isFinite(c.phase)||c.phase<0||c.phase>=1)throw new Error('Invalid saved playback state.');
  if(c.humanPosition!==undefined&&!validFigurePosition(c.humanPosition))throw new Error('Invalid human position.');
  return c;
}
