import * as THREE from 'three';

/** Gallery architecture; every room light follows the ambient control. */
export function buildGallery(scene: THREE.Object3D) {
  const plaster = new THREE.MeshStandardMaterial({color:'#f3f1eb',roughness:.94});
  const stone = new THREE.MeshStandardMaterial({color:'#c9c6bc',roughness:.72});
  const ceiling = new THREE.MeshStandardMaterial({color:'#f5f4ee',roughness:.95,emissive:'#f5f4ee',emissiveIntensity:.28});
  const trim = new THREE.MeshStandardMaterial({color:'#e3e0d8',roughness:.65});
  const box=(w:number,h:number,d:number,x:number,y:number,z:number,m:THREE.Material)=>{
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);mesh.position.set(x,y,z);
    mesh.receiveShadow=true;scene.add(mesh);return mesh;
  };
  box(12,.12,16,0,-.99,3,stone);
  box(12,3.6,.15,0,.87,-1.25,plaster);
  box(.15,3.6,16,-5,.87,3,plaster);
  box(.15,3.6,16,5,.87,3,plaster);
  box(12,.15,16,0,2.72,3,ceiling);
  box(10,.075,.025,0,-.88,-1.16,trim);
  for(const x of [-5,5])box(.025,.075,16,x>0?4.91:-4.91,-.88,3,trim);
  const joint=new THREE.MeshStandardMaterial({color:'#aaa89f',roughness:.9});
  for(let x=-4;x<=4;x+=2)box(.004,.001,12,x,-.929,3,joint);
  for(let z=-1;z<=9;z+=2)box(10,.001,.004,0,-.929,z,joint);
  const luminous=new THREE.MeshBasicMaterial({color:'#fff7e8'});
  const galleryLights: THREE.SpotLight[]=[];
  for(const x of [-2.5,2.5]){
    box(.045,.025,8,x,2.63,2,luminous);
    const light=new THREE.SpotLight('#fff4e3',90,12,1.1,.85,2);
    light.position.set(x,2.52,2);light.target.position.set(x*.5,-.93,.8);
    light.castShadow=true;light.shadow.mapSize.set(1024,1024);light.shadow.normalBias=.015;
    scene.add(light,light.target);galleryLights.push(light);
  }
  const hemisphere=new THREE.HemisphereLight('#fffdf6','#b6ada0',.65);scene.add(hemisphere);
  // Wall label, deliberately subordinate to the work.
  const canvas=document.createElement('canvas');canvas.width=768;canvas.height=256;
  const ctx=canvas.getContext('2d')!;ctx.fillStyle='#f3f1eb';ctx.fillRect(0,0,768,256);
  ctx.fillStyle='#3b3c38';ctx.font='30px sans-serif';ctx.fillText('FARAWAY LANDSCAPES',35,80);
  ctx.font='20px sans-serif';ctx.fillText('Kinetic fabric · light · time',35,130);
  const label=new THREE.Mesh(new THREE.PlaneGeometry(.52,.173),new THREE.MeshStandardMaterial({map:new THREE.CanvasTexture(canvas),roughness:1}));
  label.position.set(-1.65,-.1,-1.16);scene.add(label);

  return { setAmbient(value:number) {
    const ambient=THREE.MathUtils.clamp(value,0,1);
    galleryLights.forEach(light=>light.intensity=45*ambient);
    hemisphere.intensity=.65*ambient;
    ceiling.emissiveIntensity=.12*ambient;
    luminous.color.set('#fff7e8').multiplyScalar(ambient);
  }};
}
