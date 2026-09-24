import * as THREE from 'three';
import { LED_WIDTH, LED_HEIGHT, LED_DEPTH, LIGHT_GROUPS, LedController, perimeterPoint } from './leds';

/** Every emitter is visible/addressable; nearby emitters share four light sources. */
export class LedScene {
  private emitters!: THREE.InstancedMesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  private lights: THREE.SpotLight[] = [];
  private railGroup = new THREE.Group();
  private brackets: THREE.Mesh[] = [];
  private color = new THREE.Color();
  private colorSum = new THREE.Color();
  private shadows = true;
  constructor(private scene: THREE.Scene, readonly controller: LedController) {
    scene.add(this.railGroup);
    const railMaterial = new THREE.MeshStandardMaterial({ color: '#242a29', metalness: .5, roughness: .4 });
    for (const [w, h, x, y] of [
      [LED_WIDTH + .025, .022, 0, LED_HEIGHT / 2], [LED_WIDTH + .025, .022, 0, -LED_HEIGHT / 2],
      [.022, LED_HEIGHT, -LED_WIDTH / 2, 0], [.022, LED_HEIGHT, LED_WIDTH / 2, 0],
    ]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(w, h, .018), railMaterial);
      rail.position.set(x, y, LED_DEPTH - .012); rail.receiveShadow = true;
      this.railGroup.add(rail);
    }
    // Four small standoffs connect the forward light rail to the rear frame.
    const bracketGeometry = new THREE.BoxGeometry(.014, .014, LED_DEPTH + .19);
    for (const x of [-LED_WIDTH / 2, LED_WIDTH / 2]) for (const y of [-LED_HEIGHT / 2, LED_HEIGHT / 2]) {
      const bracket = new THREE.Mesh(bracketGeometry, railMaterial);
      bracket.position.set(x, y, (LED_DEPTH - .19) / 2);
      scene.add(bracket); this.brackets.push(bracket);
    }
    for (let i = 0; i < LIGHT_GROUPS; i++) {
      const light = new THREE.SpotLight('#ffffff', 0, 6, 1.1, .65, 2);
      light.castShadow = true;
      light.shadow.mapSize.set(1024, 1024);
      light.shadow.camera.near = .02;
      light.shadow.camera.far = 6;
      light.shadow.bias = -.0001;
      light.shadow.normalBias = .004;
      light.target.position.set(0, 0, .09);
      scene.add(light, light.target); this.lights.push(light);
    }
    this.rebuild();
  }
  rebuild() {
    if (this.emitters) {
      this.scene.remove(this.emitters);
      this.emitters.dispose(); this.emitters.geometry.dispose(); this.emitters.material.dispose();
    }
    this.emitters = new THREE.InstancedMesh(new THREE.SphereGeometry(.010, 10, 6),
      new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }), this.controller.count);
    const matrix = new THREE.Matrix4();
    this.controller.samples.forEach((sample, i) => {
      matrix.makeTranslation(sample.x, sample.y, sample.z);
      this.emitters.setMatrixAt(i, matrix);
      this.emitters.setColorAt(i, this.color.setRGB(0, 0, 0));
    });
    this.emitters.instanceColor!.setUsage(THREE.DynamicDrawUsage);
    this.scene.add(this.emitters);
    this.update();
  }
  update() {
    const samples = this.controller.update();
    const depth = this.controller.settings.depth;
    this.railGroup.position.z = depth - LED_DEPTH;
    this.emitters.position.z = depth - LED_DEPTH;
    this.brackets.forEach(bracket => {
      bracket.position.z = (depth - .19) / 2;
      bracket.scale.z = (depth + .19) / (LED_DEPTH + .19);
    });
    samples.forEach((sample, i) => {
      this.color.setRGB(sample.r, sample.g, sample.b, THREE.SRGBColorSpace).multiplyScalar(sample.level * 2.4);
      this.emitters.setColorAt(i, this.color);
    });
    this.emitters.instanceColor!.needsUpdate = true;
    if (this.shadows !== this.controller.settings.shadows) {
      this.shadows = this.controller.settings.shadows;
      this.lights.forEach(light => light.castShadow = this.shadows);
    }
    this.lights.forEach((light, group) => {
      let energy = 0, x = 0, y = 0;
      this.colorSum.setRGB(0, 0, 0);
      const start = Math.floor(group * samples.length / LIGHT_GROUPS);
      const end = Math.floor((group + 1) * samples.length / LIGHT_GROUPS);
      for (let i = start; i < end; i++) {
        const s = samples[i]; energy += s.level; x += s.x * s.level; y += s.y * s.level;
        this.color.setRGB(s.r, s.g, s.b, THREE.SRGBColorSpace).multiplyScalar(s.level);
        this.colorSum.add(this.color);
      }
      if (energy > 1e-8) {
        // Project the weighted location back onto the rail, including corners.
        const meanX = x / energy, meanY = y / energy;
        const scale = Math.max(Math.abs(meanX) / (LED_WIDTH / 2), Math.abs(meanY) / (LED_HEIGHT / 2));
        light.position.set(meanX / Math.max(scale, .001), meanY / Math.max(scale, .001), depth + .005);
        light.color.copy(this.colorSum).multiplyScalar(1 / energy);
      } else {
        const p = perimeterPoint((group + .5) / LIGHT_GROUPS); light.position.set(p.x, p.y, depth);
      }
      // Keep overall illumination comparable while testing different LED counts.
      light.intensity = energy * .35 * 60 / samples.length;
      light.shadow.needsUpdate = true;
    });
  }
  diagnostics() {
    return { depth: this.controller.settings.depth, railDepth: this.railGroup.position.z + LED_DEPTH, emitterDepth: this.emitters.position.z + LED_DEPTH, emitters: this.emitters.count, sources: this.lights.length, shadowSources: this.lights.filter(l => l.castShadow).length,
      lightPositions: this.lights.map(l => l.position.toArray()), totalIntensity: this.lights.reduce((sum, l) => sum + l.intensity, 0) };
  }
}
