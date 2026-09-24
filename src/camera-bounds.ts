/** Interior wall faces, with 12 cm clearance to keep the near plane inside.
 * The gallery has no front wall: positive Z is deliberately unbounded.
 */
export const CAMERA_BOUNDS = { minX: -4.805, maxX: 4.805, minY: -.81, maxY: 2.525, minZ: -1.055 };
interface Point { x:number; y:number; z:number; }
function clampPoint(p:Point) {
  p.x=Math.max(CAMERA_BOUNDS.minX,Math.min(CAMERA_BOUNDS.maxX,p.x));
  p.y=Math.max(CAMERA_BOUNDS.minY,Math.min(CAMERA_BOUNDS.maxY,p.y));
  p.z=Math.max(CAMERA_BOUNDS.minZ,p.z);
}
export function constrainGalleryCamera(position:Point,target:Point):boolean {
  const px=position.x,py=position.y,pz=position.z;
  const tx=target.x,ty=target.y,tz=target.z;
  // Stop panning the orbit centre through a wall, translating the camera with it.
  clampPoint(target);
  position.x+=target.x-tx;position.y+=target.y-ty;position.z+=target.z-tz;
  clampPoint(position);
  // Avoid an undefined viewing direction when both reach the same corner.
  if(Math.hypot(position.x-target.x,position.y-target.y,position.z-target.z)<.05)target.z=position.z+1;
  return position.x!==px||position.y!==py||position.z!==pz||target.x!==tx||target.y!==ty||target.z!==tz;
}
