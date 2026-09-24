import { Quaternion, Vector3 } from 'three';

// Bottom of the existing feet: centre -0.915 minus half their 0.025 m thickness.
export const SCULPTURE_FLOOR_OFFSET = .9275;

export function besideViewer(position: Vector3, orientation: Quaternion) {
  const forward=new Vector3(0,0,-1).applyQuaternion(orientation);forward.y=0;
  if(forward.lengthSq()<.0001)forward.set(0,0,-1);else forward.normalize();
  const right=new Vector3().crossVectors(forward,new Vector3(0,1,0));
  return new Vector3(position.x,0,position.z).addScaledVector(right,1.8).addScaledVector(forward,1.5);
}

export function floorFromRay(origin: Vector3, direction: Vector3, viewer: Vector3) {
  if(direction.y>=-.08)return null;
  const t=-origin.y/direction.y;if(t<=0)return null;
  const point=origin.clone().addScaledVector(direction,t);point.y=0;
  const distance=Math.hypot(point.x-viewer.x,point.z-viewer.z);
  return distance>=1.3&&distance<=6?point:null;
}

export function sculptureYaw(point: Vector3, viewer: Vector3) {
  return Math.atan2(viewer.x-point.x,viewer.z-point.z);
}
