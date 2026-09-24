import { Quaternion, Vector3 } from 'three';
import { FabricScene } from './scene';
import { besideViewer, floorFromRay, SCULPTURE_FLOOR_OFFSET, sculptureYaw } from './xr-placement';

/** Floor-based passthrough session. Placement stays fixed until an explicit select. */
export class MixedReality {
  private session: XRSession | null=null;
  private restore: (()=>void) | null=null;
  private pendingPlacement=true;
  private busy=false;
  private space: XRReferenceSpace | null=null;
  private overlay=document.createElement('div');
  private button=document.createElement('button');
  private status=document.createElement('span');
  private recenter=document.createElement('button');
  private viewer=new Vector3();
  private onReset=()=>{this.pendingPlacement=true;this.view.sculpture.visible=false;};

  constructor(private view: FabricScene) {
    this.overlay.id='xr-overlay';this.status.id='xr-status';this.status.setAttribute('role','status');
    this.button.textContent='Checking mixed reality…';this.button.disabled=true;this.button.setAttribute('aria-describedby','xr-status');
    this.recenter.textContent='Place beside me';this.recenter.hidden=true;
    const panel=document.createElement('div');panel.id='xr-tools';
    panel.append(this.button,this.recenter,this.status);this.overlay.append(panel);document.body.append(this.overlay);
    this.overlay.addEventListener('beforexrselect',event=>event.preventDefault());
    this.button.addEventListener('click',()=>void this.toggle());
    this.recenter.addEventListener('click',()=>{this.pendingPlacement=true;});
    void this.checkSupport();
  }

  private async checkSupport() {
    if(!window.isSecureContext){this.button.textContent='Mixed reality needs HTTPS';this.status.textContent='Open the HTTPS site in your headset browser.';return;}
    if(!navigator.xr){this.button.textContent='Mixed reality unavailable';this.status.textContent='Open this page in a WebXR passthrough-capable browser.';return;}
    try {
      const supported=await navigator.xr.isSessionSupported('immersive-ar');
      this.button.disabled=!supported;this.button.textContent=supported?'View in mixed reality':'Mixed reality unavailable';
      this.status.textContent=supported?'Life size · placed on your floor beside you':'This browser does not support immersive AR.';
    }catch{this.button.textContent='Mixed reality unavailable';this.status.textContent='WebXR access is blocked by this browser.';}
  }

  private finish=()=>{
    this.space?.removeEventListener('reset',this.onReset);this.space=null;
    this.session=null;this.restore?.();this.restore=null;
    this.pendingPlacement=true;this.busy=false;this.button.disabled=false;
    this.button.textContent='View in mixed reality';this.recenter.hidden=true;
    document.body.classList.remove('in-xr');this.status.textContent='Mixed reality ended. Your gallery view is restored.';
  };

  private async toggle() {
    if(this.busy)return;
    if(this.session){try{await this.session.end();}catch{this.status.textContent='Use the headset menu to end mixed reality.';}return;}
    this.busy=true;this.button.disabled=true;
    try {
      const session=await navigator.xr!.requestSession('immersive-ar',{
        requiredFeatures:['local-floor'],optionalFeatures:['dom-overlay'],domOverlay:{root:this.overlay},
      });
      // Let Three restore its framebuffer/pixel ratio before resizing the gallery.
      this.session=session;session.addEventListener('end',()=>queueMicrotask(this.finish),{once:true});
      if(session.environmentBlendMode==='opaque')throw new Error('Passthrough is unavailable on this device.');
      this.restore=this.view.enterMixedReality();
      await this.view.renderer.xr.setSession(session);
      if(this.session!==session)return;
      this.space=this.view.renderer.xr.getReferenceSpace();this.space?.addEventListener('reset',this.onReset);
      session.addEventListener('select',event=>this.select(event));
      this.button.textContent='Exit mixed reality';this.button.disabled=false;this.recenter.hidden=false;
      document.body.classList.add('in-xr');
      this.status.textContent='Point at the floor and press trigger / tap to move. Use your headset menu to exit.';
    }catch(error){
      const session=this.session;
      if(session){try{await session.end();}catch{/* Restore even when startup failed. */}}
      this.finish();
      this.status.textContent=error instanceof Error?`Could not start mixed reality: ${error.message}`:'Could not start mixed reality. Check floor setup and permissions.';
    }finally{this.busy=false;}
  }

  private place(point: Vector3) {
    this.view.sculpture.position.set(point.x,SCULPTURE_FLOOR_OFFSET,point.z);
    this.view.sculpture.rotation.set(0,sculptureYaw(point,this.viewer),0);
    this.view.sculpture.visible=true;this.pendingPlacement=false;
  }

  update(frame?: XRFrame) {
    if(!frame||!this.space)return;
    const pose=frame.getViewerPose(this.space);if(!pose)return;
    const p=pose.transform.position,q=pose.transform.orientation;
    this.viewer.set(p.x,p.y,p.z);
    if(this.pendingPlacement)this.place(besideViewer(this.viewer,new Quaternion(q.x,q.y,q.z,q.w)));
  }

  private select(event: XRInputSourceEvent) {
    if(!this.space)return;
    const pose=event.frame.getPose(event.inputSource.targetRaySpace,this.space);if(!pose)return;
    const viewer=event.frame.getViewerPose(this.space);if(!viewer)return;
    this.viewer.set(viewer.transform.position.x,viewer.transform.position.y,viewer.transform.position.z);
    const p=pose.transform.position,q=pose.transform.orientation;
    const direction=new Vector3(0,0,-1).applyQuaternion(new Quaternion(q.x,q.y,q.z,q.w));
    const point=floorFromRay(new Vector3(p.x,p.y,p.z),direction,this.viewer);
    if(point)this.place(point);
  }
}
