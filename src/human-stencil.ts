import * as THREE from 'three';
const POSITION_KEY='faraway-landscapes.figure-position.v1';
export type FigurePosition = [number,number];
export function validFigurePosition(p:unknown): p is FigurePosition {
  return Array.isArray(p)&&p.length===2&&p.every(v=>typeof v==='number'&&Number.isFinite(v))&&p[0]>=-4.5&&p[0]<=4.5&&p[1]>=-.6&&p[1]<=8;
}
export class HumanStencil {
  readonly mesh:THREE.Mesh<THREE.PlaneGeometry,THREE.MeshBasicMaterial>;
  private ring:THREE.Mesh;
  selected=false;
  private pixels?:Uint8ClampedArray;
  private texture:THREE.Texture;
  onSelect=(selected:boolean)=>{};
  onStorageError=()=>{};
  constructor(scene:THREE.Scene){
    this.texture=new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}assets/human-silhouette.png`,texture=>{
      const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=1536;
      const ctx=canvas.getContext('2d')!;ctx.drawImage(texture.image,0,0);this.pixels=ctx.getImageData(0,0,1024,1536).data;
    });
    // Crop transparent margins using UVs; retain the original generated alpha.
    this.texture.offset.set(273/1024,11/1536);this.texture.repeat.set(593/1024,1511/1536);
    this.mesh=new THREE.Mesh(new THREE.PlaneGeometry(1.75*593/1511,1.75),new THREE.MeshBasicMaterial({map:this.texture,color:0x000000,alphaTest:.25,side:THREE.DoubleSide}));
    this.mesh.geometry.translate(0,1.75/2,0);this.mesh.position.set(1.95,-.93,.65);
    this.mesh.castShadow=true;
    this.mesh.customDepthMaterial=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,map:this.texture,alphaTest:.25,side:THREE.DoubleSide});
    scene.add(this.mesh);
    this.ring=new THREE.Mesh(new THREE.RingGeometry(.38,.39,64),new THREE.MeshBasicMaterial({color:'#8c966d',side:THREE.DoubleSide}));
    this.ring.rotation.x=-Math.PI/2;this.ring.visible=false;scene.add(this.ring);this.restore();
  }
  get position():FigurePosition{return [this.mesh.position.x,this.mesh.position.z];}
  setPosition(p:FigurePosition,persist=true){if(!validFigurePosition(p))return;this.mesh.position.x=p[0];this.mesh.position.z=p[1];if(persist)this.save();}
  restore(){try{const p=JSON.parse(localStorage.getItem(POSITION_KEY)??'null');if(validFigurePosition(p))this.setPosition(p,false);}catch{/* Default placement when browser storage is unavailable. */}}
  private save(){try{localStorage.setItem(POSITION_KEY,JSON.stringify(this.position));}catch{this.onStorageError();}}
  select(selected:boolean){this.selected=selected;this.ring.visible=selected;this.onSelect(selected);}
  hit(ray:THREE.Raycaster){
    const hit=ray.intersectObject(this.mesh)[0];if(!hit?.uv||!this.pixels)return false;
    const uv=hit.uv.clone();this.texture.transformUv(uv);
    const x=Math.min(1023,Math.max(0,Math.floor(uv.x*1024))),y=Math.min(1535,Math.max(0,Math.floor(uv.y*1536)));
    return this.pixels[(y*1024+x)*4+3]>64;
  }
  move(key:string,camera:THREE.Camera,fast=false){
    const forward=new THREE.Vector3();camera.getWorldDirection(forward);forward.y=0;forward.normalize();
    const right=new THREE.Vector3().crossVectors(forward,new THREE.Vector3(0,1,0)).normalize();
    const direction=key==='ArrowUp'?forward:key==='ArrowDown'?forward.negate():key==='ArrowRight'?right:right.negate();
    const step=fast?.2:.05;
    this.setPosition([THREE.MathUtils.clamp(this.mesh.position.x+direction.x*step,-4.5,4.5),THREE.MathUtils.clamp(this.mesh.position.z+direction.z*step,-.6,8)]);
  }
  update(camera:THREE.Camera){
    // Upright camera-facing stencil; position remains fixed in the room.
    this.mesh.rotation.y=Math.atan2(camera.position.x-this.mesh.position.x,camera.position.z-this.mesh.position.z);
    this.ring.position.set(this.mesh.position.x,-.925,this.mesh.position.z);
  }
}
