import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Quaternion, Vector3 } from 'three';
import { besideViewer, floorFromRay, sculptureYaw, SCULPTURE_FLOOR_OFFSET } from '../src/xr-placement';

test('MR initial placement follows heading, stays on floor and faces viewer',()=>{
  for(const yaw of [0,Math.PI/2,Math.PI,-Math.PI/2]){
    const viewer=new Vector3(3,1.7,4),q=new Quaternion().setFromAxisAngle(new Vector3(0,1,0),yaw);
    const point=besideViewer(viewer,q);
    assert.equal(point.y,0);assert.ok(Math.abs(point.distanceTo(new Vector3(3,0,4))-Math.hypot(1.8,1.5))<1e-9);
    const normal=new Vector3(0,0,1).applyAxisAngle(new Vector3(0,1,0),sculptureYaw(point,viewer));
    const toViewer=viewer.clone().sub(point);toViewer.y=0;toViewer.normalize();assert.ok(normal.dot(toViewer)>.999);
  }
  assert.ok(Math.abs(SCULPTURE_FLOOR_OFFSET-.915-.025/2)<1e-9);
});
test('MR rejects horizon, upward, behind-ray, near and distant placements',()=>{
  const viewer=new Vector3(0,1.6,0);
  assert.equal(floorFromRay(viewer,new Vector3(0,0,-1),viewer),null);
  assert.equal(floorFromRay(viewer,new Vector3(0,1,-1),viewer),null);
  assert.equal(floorFromRay(new Vector3(0,-1,0),new Vector3(0,-1,-1),viewer),null);
  assert.equal(floorFromRay(viewer,new Vector3(0,-1,0),viewer),null);
  assert.equal(floorFromRay(viewer,new Vector3(0,-.1,-1),viewer),null);
  const point=floorFromRay(viewer,new Vector3(0,-1,-1).normalize(),viewer)!;
  assert.equal(point.y,0);assert.ok(Math.abs(point.z+1.6)<1e-9);
});
