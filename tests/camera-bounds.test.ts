import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CAMERA_BOUNDS as b,constrainGalleryCamera} from '../src/camera-bounds';
const inside=(p:{x:number,y:number,z:number})=>p.x>=b.minX&&p.x<=b.maxX&&p.y>=b.minY&&p.y<=b.maxY&&p.z>=b.minZ;
test('camera stops at each solid gallery face and diagonal corners',()=>{
 for(const p of [{x:-30,y:0,z:2},{x:30,y:0,z:2},{x:0,y:-30,z:2},{x:0,y:30,z:2},{x:0,y:0,z:-30},{x:30,y:30,z:-30}]){
  const t={x:0,y:0,z:0};assert.ok(constrainGalleryCamera(p,t));assert.ok(inside(p));assert.ok(inside(t));
 }
});
test('open end remains unrestricted and legal poses do not move',()=>{
 for(const z of [6,12,25,100]){const p={x:2,y:1,z},t={x:0,y:0,z:0};assert.equal(constrainGalleryCamera(p,t),false);assert.equal(p.z,z);}
});
test('panning is bounded and corner collisions keep a nonzero viewing direction',()=>{
 const p={x:200,y:200,z:-200},t={...p};constrainGalleryCamera(p,t);
 assert.ok(inside(p)&&inside(t));assert.ok(Math.hypot(p.x-t.x,p.y-t.y,p.z-t.z)>=.05);
 const before=JSON.stringify([p,t]);assert.equal(constrainGalleryCamera(p,t),false);assert.equal(JSON.stringify([p,t]),before);
});
