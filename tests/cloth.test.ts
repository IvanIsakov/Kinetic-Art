import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ClothSimulation, FIXED_DT, MAX_STROKE, PISTON_SPEED, REAR_LIMIT, RESOLUTIONS, patternValue, stretchCompliance, type Pattern } from '../src/cloth';
import { pistonRenderPose, FABRIC_CLEARANCE, HEAD_THICKNESS } from '../src/scene';

function advance(sim: ClothSimulation, steps: number) { for (let i = 0; i < steps; i++) sim.step(); }

test('all patterns stay inside normalized travel limits', () => {
  for (const pattern of ['wave', 'ripple', 'breathing', 'circulating', 'sequential', 'flat'] as Pattern[]) {
    for (let i = 0; i < 20; i++) for (let t = 0; t < 15; t += 0.37) {
      const value = patternValue(pattern, i % 5, Math.floor(i / 5), t);
      assert.ok(value >= 0 && value <= 1, `${pattern} exceeded its range`);
    }
  }
});

test('pistons are speed limited and clamp manual travel to the supported stroke', () => {
  const sim = new ClothSimulation(); sim.overrides[7] = 10;
  sim.step();
  assert.ok(Math.abs(sim.pistonPositions[7] - PISTON_SPEED * FIXED_DT) < 1e-8);
  advance(sim, 280);
  assert.ok(Math.abs(sim.pistonPositions[7] - MAX_STROKE) < 1e-7);
});

test('every tip attaches a patch and patches remain exactly attached during a wave', () => {
  const sim = new ClothSimulation(); advance(sim, 220);
  for (let p = 0; p < 20; p++) {
    assert.ok(Array.from(sim.attachment).filter(id => id === p).length >= 3);
  }
  for (let i = 0; i < sim.attachment.length; i++) {
    const p = sim.attachment[i]; if (p < 0) continue;
    assert.equal(sim.positions[i * 3], sim.rest[i * 3]);
    assert.equal(sim.positions[i * 3 + 1], sim.rest[i * 3 + 1]);
    assert.equal(sim.positions[i * 3 + 2], sim.pistonPositions[p]);
  }
});

test('fixed frame keeps its entire perimeter still while an interior peak extends', () => {
  const sim = new ClothSimulation(); sim.settings.edges = 'fixed'; sim.settings.pattern = 'flat'; sim.overrides[7] = .22;
  advance(sim, 220);
  assert.ok(sim.pistonPositions[7] > 0.2);
  for (let i = 0; i < sim.boundary.length; i++) if (sim.boundary[i]) assert.equal(sim.positions[i * 3 + 2], 0);
  sim.pistonXY.forEach((p, i) => { if (p.boundary) assert.equal(sim.pistonPositions[i], 0); });
});

test('extreme adjacent offsets, material settings and rapid changes remain finite and bounded', () => {
  const sim = new ClothSimulation(); sim.settings.amplitude = MAX_STROKE;
  for (const edge of ['fixed', 'moving'] as const) {
    sim.settings.edges = edge; sim.reset();
    for (const pattern of ['sequential', 'flat', 'circulating', 'wave'] as Pattern[]) {
      sim.settings.pattern = pattern;
      sim.settings.resistance = pattern === 'circulating' ? 0 : 1;
      sim.settings.slack = pattern === 'sequential' ? 0.1 : 0;
      sim.settings.damping = 0;
      advance(sim, 160);
      assert.ok(sim.positions.every(Number.isFinite));
      const m = sim.metrics();
      assert.ok(m.minZ >= REAR_LIMIT - 1e-7);
      assert.ok(m.maxZ < 0.7, `unexpected excursion ${m.maxZ}`);
      assert.ok(sim.pistonPositions.every(p => p >= 0 && p <= MAX_STROKE + 1e-7));
    }
  }
});

test('reset reproduces the same state and static input settles', () => {
  const sim = new ClothSimulation(); sim.settings.pattern = 'flat'; sim.overrides[7] = .22; sim.settings.damping = 0.9;
  advance(sim, 180); const first = Array.from(sim.positions);
  sim.reset(); advance(sim, 180); assert.deepEqual(Array.from(sim.positions), first);
  advance(sim, 450); const before = new Float32Array(sim.positions);
  advance(sim, 60);
  let squared = 0;
  for (let i = 0; i < before.length; i++) squared += (before[i] - sim.positions[i]) ** 2;
  const rms = Math.sqrt(squared / before.length);
  assert.ok(rms < 0.002, `surface should settle within 2 mm RMS, got ${rms}`);
});

test('heads and rods stay behind the fabric throughout the full stroke', () => {
  for (let z = 0; z <= MAX_STROKE; z += 0.005) {
    const pose = pistonRenderPose(z);
    assert.ok(z - (pose.headCenter + HEAD_THICKNESS / 2) >= FABRIC_CLEARANCE - 1e-9);
    assert.ok(z - (pose.rodCenter + pose.rodLength / 2) >= FABRIC_CLEARANCE + HEAD_THICKNESS - 1e-9);
    assert.ok(pose.rodLength > 0);
  }
});

test('every supported grid has patches for every piston, including off-mesh anchor positions', () => {
  for (let cols = 5; cols <= 10; cols++) for (let rows = 4; rows <= 10; rows++) {
    const sim = new ClothSimulation(cols, rows);
    assert.equal(sim.pistonPositions.length, cols * rows);
    const counts = new Uint16Array(cols * rows);
    sim.attachment.forEach(id => { if (id >= 0) counts[id]++; });
    assert.ok(counts.every(count => count >= 4), `missing patch in ${cols} × ${rows}`);
    let peaks = 0;
    for (let i = 0; i < cols * rows; i++) peaks += Number(patternValue('circulating', i % cols, Math.floor(i / cols), 0, cols, rows) === 1);
    assert.equal(peaks, 1);
    assert.equal(sim.pistonXY.filter(p => !p.boundary).length, (cols - 2) * (rows - 2));
  }
  assert.throws(() => new ClothSimulation(11, 10), RangeError);
  assert.throws(() => new ClothSimulation(5, 3), RangeError);
  assert.throws(() => new ClothSimulation(5.5, 4), RangeError);
});

test('extended resistance stays positive and becomes progressively stiffer', () => {
  let previous = Infinity;
  for (let r = 0; r <= 3; r += .01) {
    const compliance = stretchCompliance(r);
    assert.ok(compliance > 0 && compliance < previous);
    previous = compliance;
  }
  assert.ok(stretchCompliance(3) < stretchCompliance(1) / 100);
});

test('extended tension and resistance each reduce static sag beyond the old maximum', () => {
  const sag = (resistance: number, slack: number) => {
    const sim = new ClothSimulation();
    Object.assign(sim.settings, { pattern: 'flat', resistance, slack });
    advance(sim, 600);
    let sum = 0, count = 0;
    for (let i = 0; i < sim.invMass.length; i++) if (sim.invMass[i]) {
      sum += Math.max(0, sim.rest[i * 3 + 1] - sim.positions[i * 3 + 1]); count++;
    }
    assert.ok(sim.positions.every(Number.isFinite));
    return sum / count;
  };
  const oldMax = sag(1, 0);
  assert.ok(sag(3, 0) < oldMax * .2, 'stronger resistance should substantially reduce sag');
  assert.ok(sag(1, -.2) < oldMax * .2, 'pre-tension should substantially reduce sag');
});

test('dense and irregular grids remain attached and stable at maximum material settings', () => {
  for (const [cols, rows] of [[7, 8], [10, 10]]) {
    const sim = new ClothSimulation(cols, rows);
    Object.assign(sim.settings, { resistance: 3, slack: -.2, amplitude: MAX_STROKE, damping: 0 });
    for (const pattern of ['sequential', 'wave', 'circulating'] as Pattern[]) {
      sim.settings.pattern = pattern; advance(sim, 140);
      assert.ok(sim.positions.every(Number.isFinite));
      assert.ok(sim.metrics().maxZ < .7);
      assert.ok(sim.metrics().minZ >= REAR_LIMIT - 1e-7);
      for (let i = 0; i < sim.attachment.length; i++) if (sim.attachment[i] >= 0) {
        assert.equal(sim.positions[i * 3 + 2], sim.pistonPositions[sim.attachment[i]]);
      }
    }
    sim.settings.edges = 'fixed'; sim.reset(); advance(sim, 80);
    sim.pistonXY.forEach((p, i) => { if (p.boundary) assert.equal(sim.pistonPositions[i], 0); });
  }
});

test('all mesh resolutions retain a patch for every piston in every supported grid', () => {
  for (const resolution of RESOLUTIONS) for (let cols = 5; cols <= 10; cols++) for (let rows = 4; rows <= 10; rows++) {
    const sim = new ClothSimulation(cols, rows, resolution);
    assert.equal(sim.invMass.length, (resolution + 1) * (resolution * 3 / 4 + 1));
    assert.equal(sim.indices.length, resolution * resolution * 3 / 4 * 6);
    assert.ok(sim.indices.every(i => i >= 0 && i < sim.invMass.length));
    const count = new Uint16Array(cols * rows);
    sim.attachment.forEach(id => { if (id >= 0) count[id]++; });
    assert.ok(count.every(n => n >= 3), `insufficient patch on ${cols} × ${rows}, resolution ${resolution}`);
  }
  assert.throws(() => new ClothSimulation(5, 4, 40), RangeError);
});

test('remeshing preserves piston pose, manual overrides, settings and pattern time', () => {
  const source = new ClothSimulation();
  source.overrides[7] = .3;
  for (let i = 0; i < 130; i++) source.step();
  for (const resolution of RESOLUTIONS) {
    const next = new ClothSimulation(5, 4, resolution); next.resampleFrom(source);
    assert.deepEqual(next.pistonPositions, source.pistonPositions);
    assert.deepEqual(next.overrides, source.overrides);
    assert.deepEqual(next.settings, source.settings);
    assert.equal(next.time, source.time);
    assert.ok(next.positions.every(Number.isFinite));
    for (let i = 0; i < next.attachment.length; i++) if (next.attachment[i] >= 0) {
      assert.equal(next.positions[i * 3 + 2], next.pistonPositions[next.attachment[i]]);
    }
    for (let i = 0; i < 50; i++) next.step();
    assert.ok(next.positions.every(Number.isFinite));
    assert.ok(next.metrics().maxZ < .7);
  }
  assert.throws(() => new ClothSimulation(10, 10).resampleFrom(source));
});

test('coarse mesh supports the dense grid at maximum stiffness and travel', () => {
  const sim = new ClothSimulation(10, 10, 36);
  Object.assign(sim.settings, { resistance: 3, slack: -.2, amplitude: MAX_STROKE, pattern: 'flat' });
  sim.overrides.forEach((_, i) => { sim.overrides[i] = (i % 10 + Math.floor(i / 10)) % 2 ? MAX_STROKE : 0; });
  for (let i = 0; i < 250; i++) sim.step();
  assert.ok(sim.positions.every(Number.isFinite));
  assert.ok(sim.metrics().maxZ < .7);
  assert.ok(sim.metrics().minZ >= REAR_LIMIT - 1e-7);
});
