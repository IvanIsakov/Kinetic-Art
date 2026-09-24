import assert from 'node:assert/strict';
import { test } from 'node:test';
import { circulationPath, patternValue, CIRCULATION_DWELL, SEQUENTIAL_DURATION, ClothSimulation } from '../src/cloth';
import { softenGridNormals } from '../src/normals';

test('circulation travels anticlockwise with one full target and half-height neighbours', () => {
  for (const [cols, rows] of [[5,4],[10,10],[7,8]]) {
    const path = circulationPath(cols, rows);
    assert.equal(new Set(path).size, path.length);
    let area = 0;
    path.forEach((id, k) => {
      const next = path[(k+1)%path.length];
      const x=id%cols, y=-Math.floor(id/cols), nx=next%cols, ny=-Math.floor(next/cols);
      area += x*ny-nx*y;
      assert.equal(Math.abs(nx-x)+Math.abs(ny-y),1);
      for (let i=0;i<cols*rows;i++) {
        const dx=Math.abs(i%cols-x),dy=Math.abs(-Math.floor(i/cols)-y);
        assert.equal(patternValue('circulating',i%cols,Math.floor(i/cols),k*CIRCULATION_DWELL,cols,rows),i===id?1:dx<=1&&dy<=1?.5:0);
      }
    });
    assert.ok(area>0);
  }
});

test('sequential pulse fully returns before the next piston and skips fixed edges', () => {
  for (const edges of ['fixed','moving'] as const) {
    const ids=Array.from({length:20},(_,i)=>i).filter(i=>edges==='moving'||(i%5>0&&i%5<4&&Math.floor(i/5)>0&&Math.floor(i/5)<3));
    ids.forEach((id,k)=> {
      for(let i=0;i<20;i++) {
        assert.equal(patternValue('sequential',i%5,Math.floor(i/5),(k+.5)*SEQUENTIAL_DURATION,5,4,edges),i===id?1:0);
        assert.equal(patternValue('sequential',i%5,Math.floor(i/5),k*SEQUENTIAL_DURATION,5,4,edges),0);
      }
    });
  }
});

test('sequential controller retracts previous motion and respects one-at-a-time at maximum tempo', () => {
  const sim=new ClothSimulation(5,4,36);
  sim.pistonPositions.fill(.1);
  sim.settings.amplitude=.32; sim.settings.speed=2;
  sim.setPattern('sequential');
  sim.step(); assert.equal(sim.time,0);
  for(let i=0;i<100;i++)sim.step();
  for(let i=0;i<1100;i++) {
    sim.step();
    assert.ok(Array.from(sim.pistonPositions).filter(v=>v>1e-6).length<=1);
  }
});

test('normal filtering softens small variations, keeps unit vectors and preserves opposing folds', () => {
  const n=new Float32Array([.2,0,Math.sqrt(.96),-.2,0,Math.sqrt(.96),.2,0,Math.sqrt(.96),-.2,0,Math.sqrt(.96)]);
  softenGridNormals(n,1,1,new Float32Array(n.length));
  for(let i=0;i<n.length;i+=3) { assert.ok(Math.abs(n[i])<.2); assert.ok(Math.abs(Math.hypot(n[i],n[i+1],n[i+2])-1)<1e-6); }
  const fold=new Float32Array([0,0,1,0,0,-1,0,0,1,0,0,-1]);
  const before=fold.slice(); softenGridNormals(fold,1,1,new Float32Array(fold.length)); assert.deepEqual(fold,before);
});
