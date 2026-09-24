/** Metres throughout. XPBD distance constraints with a lightweight bending surrogate.
 * The solver is independent of rendering so attachment and stability can be tested.
 */
export type Pattern = 'wave' | 'ripple' | 'breathing' | 'circulating' | 'sequential' | 'flat';
export type EdgeMode = 'fixed' | 'moving';
export interface FabricSettings {
  amplitude: number;
  speed: number;
  slack: number;
  resistance: number;
  damping: number;
  edges: EdgeMode;
  pattern: Pattern;
}
export const defaults: FabricSettings = {
  amplitude: 0.22, speed: 0.65, slack: 0.025, resistance: 0.7,
  damping: 0.55, edges: 'moving', pattern: 'wave',
};
export const WIDTH = 2;
export const HEIGHT = 1.5;
export const COLS = 5;
export const ROWS = 4;
export const SEG_X = 72;
export const SEG_Y = 54;
export const RESOLUTIONS = [36, 48, 60, 72, 96] as const;
export const MAX_STROKE = 0.32;
export const REAR_LIMIT = -0.065;
export const FIXED_DT = 1 / 120;
export const PISTON_SPEED = 0.16;
export const TIP_RADIUS = 0.026;
// Covers the whole tip plus one mesh-cell diagonal, including off-grid anchors.
export const ATTACHMENT_RADIUS = 0.066;
export const CIRCULATION_DWELL = 0.5;
export const SEQUENTIAL_DURATION = 4;
const circulationPaths = new Map<string, readonly number[]>();

/** Inner ring, anticlockwise as seen from the fabric/front (+Z). */
export function circulationPath(cols: number, rows: number): readonly number[] {
  const key = `${cols}:${rows}`;
  if (!circulationPaths.has(key)) {
    const path: number[] = [];
    for (let r = 1; r < rows - 1; r++) for (let c = 1; c < cols - 1; c++) {
      if (r === 1 || r === rows - 2 || c === 1 || c === cols - 2) path.push(r * cols + c);
    }
    const angle = (id: number) => (Math.atan2((rows - 1) / 2 - Math.floor(id / cols), id % cols - (cols - 1) / 2) + Math.PI * 2) % (Math.PI * 2);
    path.sort((a, b) => angle(a) - angle(b));
    circulationPaths.set(key, path);
  }
  return circulationPaths.get(key)!;
}

export function stretchCompliance(resistance: number): number {
  const r = Math.max(0, Math.min(3, resistance));
  return r <= 1 ? 0.0000005 + (1 - r) ** 3 * 0.00018 : 0.0000005 * Math.exp(-3 * (r - 1));
}

export function patternValue(pattern: Pattern, col: number, row: number, time: number, cols = COLS, rows = ROWS, edges: EdgeMode = 'moving'): number {
  const x = col / (cols - 1), y = row / (rows - 1);
  switch (pattern) {
    case 'flat': return 0;
    case 'circulating': {
      const path = circulationPath(cols, rows);
      const peak = path[Math.floor(time / CIRCULATION_DWELL) % path.length];
      const dx = Math.abs(col - peak % cols), dy = Math.abs(row - Math.floor(peak / cols));
      return dx === 0 && dy === 0 ? 1 : dx <= 1 && dy <= 1 ? .5 : 0;
    }
    case 'sequential': {
      const fixed = edges === 'fixed';
      if (fixed && (col === 0 || col === cols - 1 || row === 0 || row === rows - 1)) return 0;
      const width = fixed ? cols - 2 : cols, height = fixed ? rows - 2 : rows;
      const id = fixed ? (row - 1) * width + col - 1 : row * width + col;
      const slot = time / SEQUENTIAL_DURATION;
      if (id !== Math.floor(slot) % (width * height)) return 0;
      return 1 - Math.abs(2 * (slot % 1) - 1);
    }
    case 'breathing': return 0.5 + 0.5 * Math.sin(time);
    case 'ripple': return 0.5 + 0.5 * Math.sin(Math.hypot(x - 0.5, y - 0.5) * 10 - time);
    case 'wave': return 0.5 + 0.5 * Math.sin(x * 5.2 + y * 2.4 - time);
  }
}

export class ClothSimulation {
  readonly segmentsY: number;
  readonly positions: Float32Array;
  readonly previous: Float32Array;
  readonly rest: Float32Array;
  readonly invMass: Float32Array;
  readonly attachment: Int16Array;
  readonly boundary: Uint8Array;
  readonly pistonPositions: Float32Array;
  readonly overrides: Float32Array;
  readonly pistonXY: { x: number; y: number; boundary: boolean }[] = [];
  readonly indices: number[] = [];
  settings: FabricSettings = { ...defaults };
  time = 0;
  private sequencePriming = false;
  private a: Int32Array;
  private b: Int32Array;
  private lengths: Float32Array;
  private kinds: Uint8Array;
  private lambdas: Float32Array;

  constructor(readonly cols = COLS, readonly rows = ROWS, readonly segmentsX = SEG_X) {
    if (!Number.isInteger(cols) || cols < 5 || cols > 10 || !Number.isInteger(rows) || rows < 4 || rows > 10) {
      throw new RangeError('Piston grid must have 5–10 columns and 4–10 rows.');
    }
    if (!(RESOLUTIONS as readonly number[]).includes(segmentsX)) throw new RangeError('Unsupported fabric resolution.');
    this.segmentsY = segmentsX * 3 / 4;
    this.positions = new Float32Array((segmentsX + 1) * (this.segmentsY + 1) * 3);
    this.previous = new Float32Array(this.positions.length);
    this.rest = new Float32Array(this.positions.length);
    this.invMass = new Float32Array(this.positions.length / 3).fill(1);
    this.attachment = new Int16Array(this.positions.length / 3).fill(-1);
    this.boundary = new Uint8Array(this.positions.length / 3);
    this.pistonPositions = new Float32Array(cols * rows);
    this.overrides = new Float32Array(cols * rows).fill(-1);
    const a: number[] = [], b: number[] = [], lengths: number[] = [], kinds: number[] = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      this.pistonXY.push({ x: c / (cols - 1) * WIDTH - WIDTH / 2,
        y: HEIGHT / 2 - r / (rows - 1) * HEIGHT,
        boundary: c === 0 || r === 0 || c === cols - 1 || r === rows - 1 });
    }
    const patchRadius = Math.min(0.48 * Math.min(WIDTH / (cols - 1), HEIGHT / (rows - 1)),
      Math.max(ATTACHMENT_RADIUS, TIP_RADIUS + Math.hypot(WIDTH / this.segmentsX, HEIGHT / this.segmentsY)));
    for (let y = 0; y <= this.segmentsY; y++) for (let x = 0; x <= this.segmentsX; x++) {
      const i = y * (this.segmentsX + 1) + x, k = i * 3;
      this.rest[k] = x / this.segmentsX * WIDTH - WIDTH / 2;
      this.rest[k + 1] = HEIGHT / 2 - y / this.segmentsY * HEIGHT;
      this.boundary[i] = +(x === 0 || x === this.segmentsX || y === 0 || y === this.segmentsY);
      const nearest = Math.round(y / this.segmentsY * (rows - 1)) * cols + Math.round(x / this.segmentsX * (cols - 1));
      const anchor = this.pistonXY[nearest];
      if (Math.hypot(this.rest[k] - anchor.x, this.rest[k + 1] - anchor.y) <= patchRadius) this.attachment[i] = nearest;
      if (x < this.segmentsX && y < this.segmentsY) {
        const right = i + 1, down = i + this.segmentsX + 1;
        // Alternate diagonals to avoid a uniform diagonal crease bias.
        if ((x + y) % 2) this.indices.push(i, down, right, right, down, down + 1);
        else this.indices.push(i, down, down + 1, i, down + 1, right);
      }
    }
    const add = (i: number, j: number, kind: number) => {
      a.push(i); b.push(j); kinds.push(kind);
      lengths.push(Math.hypot(this.rest[i * 3] - this.rest[j * 3], this.rest[i * 3 + 1] - this.rest[j * 3 + 1]));
    };
    for (let y = 0; y <= this.segmentsY; y++) for (let x = 0; x <= this.segmentsX; x++) {
      const i = y * (this.segmentsX + 1) + x;
      if (x < this.segmentsX) add(i, i + 1, 0);
      if (y < this.segmentsY) add(i, i + this.segmentsX + 1, 0);
      if (x < this.segmentsX && y < this.segmentsY) {
        add(i, i + this.segmentsX + 2, 1); add(i + 1, i + this.segmentsX + 1, 1);
      }
      if (x < this.segmentsX - 1) add(i, i + 2, 2);
      if (y < this.segmentsY - 1) add(i, i + (this.segmentsX + 1) * 2, 2);
    }
    // Long-range, tension-only links transmit high stiffness across an entire
    // piston cell. Local constraints alone converge too slowly for a taut sheet.
    const centerVertices = this.pistonXY.map(p => {
      const x = Math.round((p.x / WIDTH + 0.5) * this.segmentsX);
      const y = Math.round((0.5 - p.y / HEIGHT) * this.segmentsY);
      return y * (this.segmentsX + 1) + x;
    });
    for (let y = 0; y <= this.segmentsY; y++) for (let x = 0; x <= this.segmentsX; x++) {
      const i = y * (this.segmentsX + 1) + x;
      if (this.attachment[i] >= 0) continue;
      const c = Math.min(cols - 2, Math.floor(x / this.segmentsX * (cols - 1)));
      const r = Math.min(rows - 2, Math.floor(y / this.segmentsY * (rows - 1)));
      for (const id of [r * cols + c, r * cols + c + 1, (r + 1) * cols + c, (r + 1) * cols + c + 1]) {
        add(i, centerVertices[id], 3);
      }
    }
    this.a = new Int32Array(a); this.b = new Int32Array(b);
    this.lengths = new Float32Array(lengths); this.kinds = new Uint8Array(kinds);
    this.lambdas = new Float32Array(a.length);
    this.reset();
  }

  reset() {
    this.time = 0;
    this.sequencePriming = false;
    this.pistonPositions.fill(0);
    this.positions.set(this.rest);
    // A tiny deterministic imperfection lets compressed fabric buckle naturally.
    for (let i = 0; i < this.invMass.length; i++) if (this.attachment[i] < 0 && !this.boundary[i]) {
      this.positions[i * 3 + 2] = 0.0005 * Math.sin(i * 1.731);
    }
    this.updatePins();
    this.previous.set(this.positions);
  }

  resampleFrom(source: ClothSimulation) {
    if (this.cols !== source.cols || this.rows !== source.rows) throw new Error('Resampling requires the same piston grid.');
    this.settings = { ...source.settings };
    this.time = source.time;
    this.sequencePriming = source.sequencePriming;
    this.pistonPositions.set(source.pistonPositions);
    this.overrides.set(source.overrides);
    for (let y = 0; y <= this.segmentsY; y++) for (let x = 0; x <= this.segmentsX; x++) {
      const sx = x / this.segmentsX * source.segmentsX, sy = y / this.segmentsY * source.segmentsY;
      const ix = Math.min(source.segmentsX - 1, Math.floor(sx)), iy = Math.min(source.segmentsY - 1, Math.floor(sy));
      const u = sx - ix, v = sy - iy, a = iy * (source.segmentsX + 1) + ix;
      const ids = [a, a + 1, a + source.segmentsX + 1, a + source.segmentsX + 2];
      const weights = [(1 - u) * (1 - v), u * (1 - v), (1 - u) * v, u * v];
      const k = (y * (this.segmentsX + 1) + x) * 3;
      for (let axis = 0; axis < 3; axis++) {
        this.positions[k + axis] = ids.reduce((sum, id, i) => sum + source.positions[id * 3 + axis] * weights[i], 0);
        this.previous[k + axis] = ids.reduce((sum, id, i) => sum + source.previous[id * 3 + axis] * weights[i], 0);
      }
    }
    this.updatePins();
  }

  updatePins() {
    for (let i = 0; i < this.invMass.length; i++) {
      const fixed = this.settings.edges === 'fixed' && this.boundary[i];
      const p = this.attachment[i];
      this.invMass[i] = fixed || p >= 0 ? 0 : 1;
      if (this.invMass[i] === 0) {
        this.positions[i * 3] = this.rest[i * 3];
        this.positions[i * 3 + 1] = this.rest[i * 3 + 1];
        this.positions[i * 3 + 2] = fixed ? 0 : this.pistonPositions[p];
      }
    }
  }

  setPattern(pattern: Pattern) {
    this.settings.pattern = pattern;
    this.time = 0;
    this.overrides.fill(-1);
    // Retract the previous pattern before starting the one-at-a-time sequence.
    this.sequencePriming = pattern === 'sequential' && this.pistonPositions.some(p => p > 0);
  }

  step(animate = true) {
    const dt = FIXED_DT, s = this.settings;
    const priming = s.pattern === 'sequential' && this.sequencePriming;
    // At fast tempos the sequence slows to respect actuator speed, allowing each
    // piston to return to zero before the next starts. Other patterns may overlap.
    const tempo = s.pattern === 'sequential' ? Math.min(s.speed,
      PISTON_SPEED * SEQUENTIAL_DURATION / (2 * Math.max(s.amplitude, .001))) : s.speed;
    if (animate && !priming) this.time += dt * tempo;
    for (let i = 0; i < this.pistonPositions.length; i++) {
      let target = this.overrides[i] >= 0 ? this.overrides[i] :
        priming ? 0 : patternValue(s.pattern, i % this.cols, Math.floor(i / this.cols), this.time, this.cols, this.rows, s.edges) * s.amplitude;
      if (s.edges === 'fixed' && this.pistonXY[i].boundary) target = 0;
      target = Math.max(0, Math.min(MAX_STROKE, target));
      const d = target - this.pistonPositions[i];
      this.pistonPositions[i] += Math.max(-PISTON_SPEED * dt, Math.min(PISTON_SPEED * dt, d));
    }
    if (priming && this.pistonPositions.every(p => p <= 0)) this.sequencePriming = false;
    this.updatePins();
    const p = this.positions, old = this.previous;
    const decay = Math.exp(-(0.6 + s.damping * 9) * dt);
    for (let i = 0; i < this.invMass.length; i++) {
      const k = i * 3;
      if (this.invMass[i] === 0) { old[k] = p[k]; old[k + 1] = p[k + 1]; old[k + 2] = p[k + 2]; continue; }
      for (let axis = 0; axis < 3; axis++) {
        const index = k + axis, current = p[index];
        p[index] += (current - old[index]) * decay + (axis === 1 ? -9.81 * dt * dt : 0);
        old[index] = current;
      }
    }
    this.lambdas.fill(0);
    const compliance = stretchCompliance(s.resistance);
    const extraStiffness = Math.max(0, s.resistance - 1, -s.slack * 10);
    const alphas = [compliance / (dt * dt), compliance * 2 / (dt * dt), 0.002 / (dt * dt),
      extraStiffness > 0 ? 0.000002 / (extraStiffness ** 2 * dt * dt) : 0];
    const iterations = 5 + Math.ceil(extraStiffness * 2);
    for (let iteration = 0; iteration < iterations; iteration++) {
      // Reverse traversal on alternating passes to reduce directional solver bias.
      const reverse = iteration % 2 === 1;
      for (let n = 0; n < this.a.length; n++) {
        const j = reverse ? this.a.length - 1 - n : n;
        const kind = this.kinds[j];
        if (kind === 3 && extraStiffness === 0) continue;
        const ai = this.a[j], bi = this.b[j], wa = this.invMass[ai], wb = this.invMass[bi];
        if (wa + wb === 0) continue;
        const a = ai * 3, b = bi * 3;
        const dx = p[a] - p[b], dy = p[a + 1] - p[b + 1], dz = p[a + 2] - p[b + 2];
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist < 1e-9) continue;
        const alpha = alphas[kind];
        // Prestrain belongs to the material edges. Shortening all four anchor
        // tethers would give each vertex mutually impossible target distances.
        const length = this.lengths[j] * (1 + (kind === 3 ? Math.max(0, s.slack) : s.slack));
        let dl = (-(dist - length) - alpha * this.lambdas[j]) / (wa + wb + alpha);
        if (kind === 3) dl = Math.min(0, this.lambdas[j] + dl) - this.lambdas[j];
        this.lambdas[j] += dl;
        const scale = dl / dist;
        p[a] += wa * dx * scale; p[a + 1] += wa * dy * scale; p[a + 2] += wa * dz * scale;
        p[b] -= wb * dx * scale; p[b + 1] -= wb * dy * scale; p[b + 2] -= wb * dz * scale;
      }
      this.collide();
    }
  }

  private collide() {
    const p = this.positions;
    for (let i = 0; i < this.invMass.length; i++) {
      if (this.invMass[i] === 0) continue;
      const k = i * 3;
      // Rear clearance plane and frame opening. No full self-collision in this milestone.
      p[k + 2] = Math.max(REAR_LIMIT, p[k + 2]);
      p[k] = Math.max(-WIDTH / 2, Math.min(WIDTH / 2, p[k]));
      p[k + 1] = Math.max(-HEIGHT / 2, Math.min(HEIGHT / 2, p[k + 1]));
      // Disc-shaped piston heads: prevent nearby unpinned vertices crossing the front face.
      // Heads cannot overlap: only the nearest grid point can contain this vertex.
      const col = Math.round((p[k] / WIDTH + 0.5) * (this.cols - 1));
      const row = Math.round((0.5 - p[k + 1] / HEIGHT) * (this.rows - 1));
      const j = row * this.cols + col;
      const anchor = this.pistonXY[j], dx = p[k] - anchor.x, dy = p[k + 1] - anchor.y;
      if (dx * dx + dy * dy < TIP_RADIUS * TIP_RADIUS && p[k + 2] < this.pistonPositions[j]) {
        p[k + 2] = this.pistonPositions[j];
      }
    }
  }

  metrics() {
    let maxStrain = 0, sum = 0, count = 0, maxZ = -Infinity, minZ = Infinity;
    for (let j = 0; j < this.a.length; j++) if (this.kinds[j] === 0) {
      const a = this.a[j] * 3, b = this.b[j] * 3, p = this.positions;
      const length = Math.hypot(p[a] - p[b], p[a + 1] - p[b + 1], p[a + 2] - p[b + 2]);
      const strain = Math.max(0, length / (this.lengths[j] * (1 + this.settings.slack)) - 1);
      maxStrain = Math.max(maxStrain, strain); sum += strain; count++;
    }
    for (let i = 2; i < this.positions.length; i += 3) { maxZ = Math.max(maxZ, this.positions[i]); minZ = Math.min(minZ, this.positions[i]); }
    return { maxStrain, meanStrain: sum / count, maxZ, minZ, vertices: this.invMass.length };
  }
}
