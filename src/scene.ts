import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ClothSimulation, WIDTH, HEIGHT, TIP_RADIUS } from './cloth';

import { LedController } from './leds';
import { LedScene } from './led-scene';
import { buildGallery } from './gallery';
import { HumanStencil } from './human-stencil';
import { softenGridNormals } from './normals';

function clothGeometry(simulation: ClothSimulation) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(simulation.positions, 3).setUsage(THREE.DynamicDrawUsage));
  const { segmentsX, segmentsY } = simulation;
  const uv = new Float32Array((segmentsX + 1) * (segmentsY + 1) * 2);
  for (let y = 0; y <= segmentsY; y++) for (let x = 0; x <= segmentsX; x++) {
    const i = (y * (segmentsX + 1) + x) * 2; uv[i] = x / segmentsX; uv[i + 1] = 1 - y / segmentsY;
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geometry.setIndex(simulation.indices);
  geometry.computeVertexNormals();
  return geometry;
}

export const HEAD_THICKNESS = 0.012;
export const FABRIC_CLEARANCE = 0.01;
export function pistonRenderPose(z: number) {
  const headCenter = z - FABRIC_CLEARANCE - HEAD_THICKNESS / 2;
  const rodEnd = z - FABRIC_CLEARANCE - HEAD_THICKNESS;
  return { headCenter, rodCenter: (-0.12 + rodEnd) / 2, rodLength: rodEnd + 0.12 };
}

export class FabricScene {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(38, 1, 0.01, 40);
  readonly controls: OrbitControls;
  readonly cloth: THREE.Mesh<THREE.BufferGeometry, THREE.MeshPhysicalMaterial>;
  readonly leds = new LedController();
  readonly human: HumanStencil;
  private gallery: ReturnType<typeof buildGallery>;
  private ledScene: LedScene;
  private ambientLight = new THREE.HemisphereLight('#dce5eb', '#76664b', 1.15);
  private keyLight = new THREE.SpotLight('#ffe5b9', 65, 12, 0.65, 0.7, 2);
  private fillLight = new THREE.DirectionalLight('#d0e3ee', 1.25);
  private heads: THREE.Mesh[] = [];
  private rods: THREE.Mesh[] = [];
  private pistonGroup = new THREE.Group();
  private marker = new THREE.Mesh(new THREE.RingGeometry(0.031, 0.034, 48),
    new THREE.MeshBasicMaterial({ color: '#d0ba7e', side: THREE.DoubleSide, depthTest: false }));
  private selected = 7;
  private currentView = 'gallery';
  presentation = true;
  private resizeObserver: ResizeObserver;
  private onSelect: (id: number) => void = () => {};
  private down = { x: 0, y: 0 };
  private fabricDirty = true;
  smoothShading = true;
  private normalScratch = new Float32Array(0);

  constructor(private host: HTMLElement, private simulation: ClothSimulation) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;
    this.renderer.domElement.setAttribute('aria-label', 'Interactive fabric sculpture. Drag to orbit and scroll to zoom. Use the piston grid for keyboard selection.');
    this.renderer.domElement.setAttribute('role', 'img');
    host.appendChild(this.renderer.domElement);
    this.scene.background = new THREE.Color('#eeece6');

    this.camera.position.set(1.8, 0.85, 3.5);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.target.set(0, -0.025, 0.06);
    this.controls.minDistance = 1;
    this.controls.maxDistance = 26;
    this.controls.maxPolarAngle = Math.PI * 0.92;
    this.controls.enablePan = true;

    this.scene.add(this.ambientLight);
    const key = this.keyLight;
    key.position.set(-2.6, 2.7, 1.4);
    key.target.position.set(0, 0, 0);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.normalBias = 0.008;
    key.shadow.bias = -0.00015;
    key.shadow.camera.near = 0.1;
    this.scene.add(key, key.target);
    const fill = this.fillLight;
    fill.position.set(2, 0.5, 3);
    this.scene.add(fill);

    this.gallery=buildGallery(this.scene);
    this.human=new HumanStencil(this.scene);
    this.renderer.domElement.tabIndex=0;

    const metal = new THREE.MeshStandardMaterial({ color: '#292d2d', metalness: 0.65, roughness: 0.38 });
    const box = (w: number, h: number, d: number, x: number, y: number, z: number) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), metal);
      mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true; this.scene.add(mesh);
    };
    box(WIDTH + 0.16, 0.045, 0.28, 0, HEIGHT / 2 + 0.06, -0.19);
    box(WIDTH + 0.16, 0.045, 0.28, 0, -HEIGHT / 2 - 0.06, -0.19);
    box(0.045, HEIGHT + 0.16, 0.28, -WIDTH / 2 - 0.06, 0, -0.19);
    box(0.045, HEIGHT + 0.16, 0.28, WIDTH / 2 + 0.06, 0, -0.19);
    for (const x of [-0.8, 0.8]) {
      box(0.04, 0.12, 0.05, x, -0.87, -0.2);
      box(0.19, 0.025, 0.46, x, -0.915, -0.2);
    }
    this.scene.add(this.pistonGroup);
    this.buildPistons();
    const geometry = clothGeometry(simulation);
    // A restrained procedural weave. The folds themselves come from simulated geometry.
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    const pixels = ctx.createImageData(64, 64);
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
      const index = (y * 64 + x) * 4;
      const value = 128 + Math.sin(x * Math.PI / 2) * 30 + Math.sin(y * Math.PI / 2) * 25;
      pixels.data[index] = pixels.data[index + 1] = pixels.data[index + 2] = value;
      pixels.data[index + 3] = 255;
    }
    ctx.putImageData(pixels, 0, 0);
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(25, 18.75);
    texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    const material = new THREE.MeshPhysicalMaterial({ color: '#eee6d2', roughness: 0.93,
      metalness: 0, sheen: 0.45, sheenColor: new THREE.Color('#fff8e7'), sheenRoughness: 0.9,
      side: THREE.DoubleSide, bumpMap: texture, bumpScale: 0.0007 });
    this.cloth = new THREE.Mesh(geometry, material);
    this.cloth.castShadow = this.cloth.receiveShadow = true;
    this.cloth.frustumCulled = false;
    this.scene.add(this.cloth);
    this.ledScene = new LedScene(this.scene, this.leds);
    this.marker.renderOrder = 10;
    this.scene.add(this.marker);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(host);
    this.renderer.domElement.addEventListener('pointerdown', e => { this.down = { x: e.clientX, y: e.clientY }; });
    this.renderer.domElement.addEventListener('pointerup', e => {
      if (Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y) > 5) return;
      const rect = this.renderer.domElement.getBoundingClientRect();
      const ray=new THREE.Raycaster();
      ray.setFromCamera(new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,1-(e.clientY-rect.top)/rect.height*2),this.camera);
      const hit=this.human.hit(ray);
      this.human.select(hit);
      if(hit){this.renderer.domElement.focus({preventScroll:true});return;}
      // Select close to the projected patch even when the cloth occludes the physical head.
      let best = -1, distance = 28;
      this.simulation.pistonXY.forEach((p, i) => {
        const v = new THREE.Vector3(p.x, p.y, this.simulation.pistonPositions[i]).project(this.camera);
        const d = Math.hypot((v.x + 1) / 2 * rect.width - (e.clientX - rect.left),
          (1 - v.y) / 2 * rect.height - (e.clientY - rect.top));
        if (v.z > -1 && v.z < 1 && d < distance) { distance = d; best = i; }
      });
      if (best >= 0 && !this.presentation) this.onSelect(best);
    });
    window.addEventListener('keydown',e=>{
      if(!this.human.selected || e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement || (e.target instanceof HTMLElement && e.target.isContentEditable))return;
      if(e.key==='Escape'){this.human.select(false);return;}
      if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();this.human.move(e.key,this.camera,e.shiftKey);}
    });
    this.resize();
  }

  private buildPistons() {
    const metal = new THREE.MeshStandardMaterial({ color: '#292d2d', metalness: 0.65, roughness: 0.38 });
    const chrome = new THREE.MeshStandardMaterial({ color: '#9fa7a5', metalness: 0.85, roughness: 0.27 });
    const bodyGeometry = new THREE.CylinderGeometry(0.025, 0.025, 0.22, 16);
    const rodGeometry = new THREE.CylinderGeometry(0.008, 0.008, 1, 12);
    const headGeometry = new THREE.CylinderGeometry(TIP_RADIUS, TIP_RADIUS, HEAD_THICKNESS, 20);
    const railGeometry = new THREE.BoxGeometry(WIDTH + 0.1, 0.02, 0.025);
    const cylinder = (geometry: THREE.BufferGeometry, material: THREE.Material) => {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.rotation.x = Math.PI / 2;
      mesh.castShadow = mesh.receiveShadow = true;
      this.pistonGroup.add(mesh);
      return mesh;
    };
    for (let row = 0; row < this.simulation.rows; row++) {
      const rail = new THREE.Mesh(railGeometry, metal);
      rail.position.set(0, HEIGHT / 2 - row * HEIGHT / (this.simulation.rows - 1), -0.32);
      rail.castShadow = rail.receiveShadow = true;
      this.pistonGroup.add(rail);
    }
    this.simulation.pistonXY.forEach(p => {
      const body = cylinder(bodyGeometry, metal); body.position.set(p.x, p.y, -0.23);
      this.rods.push(cylinder(rodGeometry, chrome));
      const head = cylinder(headGeometry, metal);
      head.castShadow = false;
      this.heads.push(head);
    });
  }

  setSimulation(simulation: ClothSimulation) {
    this.fabricDirty = true;
    // Dispose only the replaced assembly. Keep camera, lights and cloth material.
    const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
    this.pistonGroup.traverse(object => {
      if (object instanceof THREE.Mesh) {
        geometries.add(object.geometry);
        const list = Array.isArray(object.material) ? object.material : [object.material];
        list.forEach(material => materials.add(material));
      }
    });
    this.pistonGroup.clear();
    geometries.forEach(geometry => geometry.dispose());
    materials.forEach(material => material.dispose());
    this.heads = []; this.rods = [];
    this.simulation = simulation;
    this.buildPistons();
    const previousGeometry = this.cloth.geometry;
    this.cloth.geometry = clothGeometry(simulation);
    previousGeometry.dispose();
    this.selected = Math.min(this.selected, simulation.pistonPositions.length - 1);
  }

  setLedCount(count: number) { this.leds.setCount(count); this.ledScene.rebuild(); }
  invalidateFabric() { this.fabricDirty = true; }

  diagnostics() {
    return {
      humanScreen: new THREE.Vector3(this.human.mesh.position.x,-.05,this.human.mesh.position.z).project(this.camera).toArray(),
      humanPosition: this.human.position, humanSelected: this.human.selected, ambient: this.leds.settings.ambient,
      heads: this.heads.length,
      leds: this.ledScene.diagnostics(),
      surfaceVertices: this.cloth.geometry.getAttribute('position').count,
      uvVertices: this.cloth.geometry.getAttribute('uv').count,
      minimumHeadClearance: Math.min(...this.heads.map((head, i) => this.simulation.pistonPositions[i] - head.position.z - HEAD_THICKNESS / 2)),
      minimumRodClearance: Math.min(...this.rods.map((rod, i) => this.simulation.pistonPositions[i] - rod.position.z - rod.scale.y / 2)),
      geometries: this.renderer.info.memory.geometries,
    };
  }

  setSelection(id: number) { this.selected = id; }
  setSelectionHandler(handler: (id: number) => void) { this.onSelect = handler; }
  setView(view: string) {
    this.currentView = view;
    const views: Record<string, number[]> = { gallery: [3.1, .65, 6.8], perspective: [1.8, 0.85, 3.5], front: [0, 0.1, 3.9], side: [4.4, 0.7, 1.5] };
    const p = views[view] ?? views.perspective;
    const fit = Math.max(1, 1.05 / this.camera.aspect);
    this.camera.position.set(view === 'gallery' && this.camera.aspect < .8 ? .5 : p[0], p[1], p[2] * fit); this.controls.target.set(view === 'gallery' ? .45 : 0, view === 'gallery' ? .45 : .1, 0); this.controls.update();
  }
  resize() {
    const { width, height } = this.host.getBoundingClientRect();
    this.renderer.setSize(width, height);
    this.camera.aspect = width / Math.max(1, height); this.camera.updateProjectionMatrix();
    this.setView(this.currentView);
  }
  draw(fabricChanged = true) {
    if (fabricChanged || this.fabricDirty) {
      this.cloth.geometry.attributes.position.needsUpdate = true;
      this.cloth.geometry.computeVertexNormals();
      if (this.smoothShading) {
        const normals = this.cloth.geometry.getAttribute('normal').array as Float32Array;
        if (this.normalScratch.length !== normals.length) this.normalScratch = new Float32Array(normals.length);
        softenGridNormals(normals, this.simulation.segmentsX, this.simulation.segmentsY, this.normalScratch);
        this.cloth.geometry.getAttribute('normal').needsUpdate = true;
      }
      this.fabricDirty = false;
    }
    this.gallery.setAmbient(this.leds.settings.ambient);
    this.human.update(this.camera);
    this.ambientLight.intensity = this.leds.settings.ambient * 1.15;
    this.keyLight.intensity = this.leds.settings.ambient * 65;
    this.fillLight.intensity = this.leds.settings.ambient * 1.25;
    this.keyLight.visible = this.leds.settings.ambient > 0;
    this.ledScene.update();
    this.simulation.pistonXY.forEach((p, i) => {
      const z = this.simulation.pistonPositions[i];
      const pose = pistonRenderPose(z);
      this.heads[i].position.set(p.x, p.y, pose.headCenter);
      this.rods[i].position.set(p.x, p.y, pose.rodCenter);
      this.rods[i].scale.y = pose.rodLength;
    });
    const selected = this.simulation.pistonXY[this.selected];
    this.marker.position.set(selected.x, selected.y, this.simulation.pistonPositions[this.selected] + 0.004);
    this.marker.visible = this.cloth.visible && !this.presentation;
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}
