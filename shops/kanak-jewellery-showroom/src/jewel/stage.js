// A small studio for one piece of jewellery: velvet backdrop, studio reflections, bloom and sparkle, a turntable
// and orbit controls. Used by the product viewer and the gallery page. Units: millimetres.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { makeJewelEnv, velvetMaterial, addStudioLights } from './materials.js';
import { realize } from './kit.js';
import { makeSparkle } from './sparkle.js';
import { bustGeometry } from './shapes.js';

function backdrop(top, bottom) {
  const c = document.createElement('canvas');
  c.width = 16;
  c.height = 256;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, top);
  gr.addColorStop(1, bottom);
  g.fillStyle = gr;
  g.fillRect(0, 0, 16, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** How each type of piece is presented: pose of the piece and the stand under it. */
const PRESENT = {
  ring: { rot: [0.42, 1.2, 0], stand: 'dais' },
  earrings: { rot: [0, 0, 0], stand: 'none' },
  necklace: { rot: [0, 0, 0], stand: 'bust' },
  pendant: { rot: [0, 0, 0], stand: 'bust' },
  bangle: { rot: [0.35, 0.9, 0], stand: 'dais' },
  bracelet: { rot: [0.5, 0.75, 0], stand: 'dais' },
  tikka: { rot: [0, 0, 0], stand: 'none' },
  nath: { rot: [0, 0.2, 0], stand: 'none' },
};

export class JewelStage {
  constructor(o) {
    o = o || {};
    this.coarse = !!o.coarse;
    this.renderer =
      o.renderer ||
      new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: o.power || 'high-performance' });
    const r = this.renderer;
    r.outputColorSpace = THREE.SRGBColorSpace;
    // Khronos PBR Neutral keeps base colours true (ACES turns yellow gold orange and rubies coral)
    r.toneMapping = THREE.NeutralToneMapping;
    r.toneMappingExposure = o.exposure || 1.0;
    r.setPixelRatio(Math.min(o.dpr || 2, window.devicePixelRatio || 1));
    this.scene = new THREE.Scene();
    // a neutral charcoal backdrop with a soft glow behind the piece: dark enough for diamonds to sparkle,
    // neutral so it does not shift how the gold looks
    this.scene.background = backdrop(o.top || '#3a3938', o.bottom || '#0f0f0f');
    this.env = makeJewelEnv(r, this.coarse ? 128 : 256);
    this.scene.environment = this.env.pmrem;
    this.scene.environmentIntensity = 0.6;
    // three-point lighting: key (front left, above), fill (front right), rim (behind)
    this.lights = addStudioLights(this.scene);
    this.camera = new THREE.PerspectiveCamera(o.fov || 30, 1, 1, 6000);
    this.camera.position.set(0, 40, 160);
    this.controls = new OrbitControls(this.camera, r.domElement);
    Object.assign(this.controls, {
      enablePan: false,
      enableDamping: true,
      dampingFactor: 0.08,
      rotateSpeed: 0.8,
      zoomSpeed: 0.8,
      minPolarAngle: 0.25,
      maxPolarAngle: 2.2,
    });
    this.controls.addEventListener('start', () => {
      this.userTurned = true;
      this.autoT = performance.now() + 4000;
    });
    this.pivot = new THREE.Group();
    this.scene.add(this.pivot);
    this.spin = !o.still;
    this.spinSpeed = o.spinSpeed || 0.35;
    this.bloom = o.bloom !== false;
    this.t0 = performance.now();
    this.velvet = velvetMaterial(o.velvet || '#0f0e0e', { sheen: '#353331', env: 0.2, sheenRough: 0.5 });
    if (this.bloom) {
      const size = r.getDrawingBufferSize(new THREE.Vector2());
      const rt = new THREE.WebGLRenderTarget(Math.max(1, size.x), Math.max(1, size.y), {
        type: THREE.HalfFloatType,
        samples: this.coarse ? 0 : 4,
      });
      this.composer = new EffectComposer(r, rt);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      // gentle bloom only on the brightest glints, so the metal's colour is not washed out
      this.bloomPass = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.14, 0.22, 1.6);
      this.composer.addPass(this.bloomPass);
      this.composer.addPass(new OutputPass());
    }
  }
  get domElement() {
    return this.renderer.domElement;
  }
  setSize(w, h) {
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.composer) {
      this.composer.setPixelRatio(this.renderer.getPixelRatio());
      this.composer.setSize(w, h);
    }
    this.w = w;
    this.h = h;
  }
  clear() {
    for (const c of [...this.pivot.children]) {
      this.pivot.remove(c);
      c.traverse((o) => {
        if (o.isMesh && o.geometry && !o.userData.shared) o.geometry.dispose();
      });
    }
    this.piece = null;
    this.sparkle = null;
  }
  /** Shows a kit. o: { type, metal, stones, whiteClaws } */
  show(kit, o) {
    this.clear();
    const pres = PRESENT[o.type] || PRESENT.ring;
    const grp = realize(kit, Object.assign({ env: this.env, pearlDetail: this.coarse ? 18 : 28 }, o));
    const holder = new THREE.Group();
    holder.add(grp);
    holder.rotation.set(pres.rot[0], pres.rot[1], pres.rot[2]);
    const sp = makeSparkle(grp.userData.glints, {
      maxPx: this.coarse ? 26 : 34,
      gain: o.sparkle == null ? 0.8 : o.sparkle,
    });
    grp.add(sp);
    this.sparkle = sp;
    this.pivot.add(holder);
    this.piece = holder;
    holder.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(grp);
    const size = box.getSize(new THREE.Vector3()),
      ctr = box.getCenter(new THREE.Vector3());
    // stands
    if (pres.stand === 'bust') {
      const [g, cap] = bustGeometry(this.coarse ? 40 : 64, this.coarse ? 32 : 48);
      for (const x of [g, cap]) {
        const m = new THREE.Mesh(x, this.velvet);
        m.userData.shared = false;
        holder.add(m);
      }
      box.expandByPoint(new THREE.Vector3(0, 120, 0)).expandByPoint(new THREE.Vector3(0, -150, 0));
    } else if (pres.stand === 'dais') {
      const y = box.min.y - 2;
      const rr = Math.max(size.x, size.z) * 0.55;
      const d = new THREE.Mesh(new THREE.CylinderGeometry(rr, rr * 1.04, 3, 64), this.velvet);
      d.position.set(ctr.x, y - 1.5, ctr.z);
      this.pivot.add(d);
    }
    // frame the camera on the piece
    const fitBox =
      pres.stand === 'bust'
        ? new THREE.Box3()
            .setFromObject(grp)
            .union(new THREE.Box3(new THREE.Vector3(-60, -60, 0), new THREE.Vector3(60, 60, 0)))
        : box;
    const s = fitBox.getSize(new THREE.Vector3()),
      c = fitBox.getCenter(new THREE.Vector3());
    if (o.type === 'ring') c.y += s.y * 0.22; // rings: look at the head
    if (o.type === 'pendant') {
      // pendants: frame the pendant and the front of the chain, not the whole bust
      const pb = new THREE.Box3().setFromObject(grp);
      c.set(0, pb.min.y + 30, (pb.max.z + c.z) / 2);
      s.set(64, 64, 30);
    }
    const rad = 0.5 * Math.max(s.x, s.y * 1.05, s.z * 0.6);
    const fov = (this.camera.fov * Math.PI) / 180;
    const dist = ((rad / Math.tan(fov / 2)) * 1.25) / Math.min(1, Math.max(0.6, this.camera.aspect || 1));
    this.controls.target.copy(c);
    if (!this.keepView) {
      this.camera.position.set(c.x, c.y + dist * 0.18, c.z + dist);
      this.controls.minDistance = dist * 0.35;
      this.controls.maxDistance = dist * 2.2;
    }
    this.controls.update();
    this.spinYaw = 0;
    return { box, glints: grp.userData.glints.length };
  }
  render(now) {
    now = now || performance.now();
    const t = (now - this.t0) / 1000;
    if (this.piece && this.spin && (!this.userTurned || now > (this.autoT || 0))) {
      this.spinYaw = (this.spinYaw || 0) + this.spinSpeed * (1 / 60);
      this.pivot.rotation.y = this.spinYaw;
    }
    this.controls.update();
    if (this.sparkle) {
      const sz = this.renderer.getDrawingBufferSize(new THREE.Vector2());
      this.sparkle.userData.update(t, this.camera, sz.x, sz.y);
    }
    if (this.composer) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }
  dispose() {
    this.clear();
    this.controls.dispose();
    if (this.composer) this.composer.dispose();
    this.renderer.dispose();
  }
}
