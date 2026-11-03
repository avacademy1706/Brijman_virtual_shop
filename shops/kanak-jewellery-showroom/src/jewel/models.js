// Imported 3D models of pieces (from the client's 3D team). scripts/import-models.mjs prepares each model and
// lists it in src/data/jewellery-models.json; here a model is loaded and turned into a Kit, so the store, the
// product viewer and the try-on show it exactly like a built piece: metal and stones still follow the shopper's
// choices (slots and roles), diamonds still sparkle, rings and bangles still follow the chosen size.
import * as THREE from 'three';
import manifest from '../data/jewellery-models.json';
import { Kit, appendKit, frameMatrix } from './kit.js';
import { buildPiece } from './build.js';

export const MODELS = manifest;
/** True if a product has an imported 3D model. */
export const hasModel = (pid) => !!manifest[pid];

const BASE = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.BASE_URL) || '/';
let reader = async (path) => {
  const r = await fetch(BASE + path);
  if (!r.ok) throw new Error('Could not load ' + path + ' (' + r.status + ')');
  return r.arrayBuffer();
};
/** Adds model entries (tests and tools that import models into a temporary folder). */
export function useModels(entries) {
  Object.assign(manifest, entries);
}
/** Replaces how model files are read (Node tests and tools read them from disk). */
export function setModelReader(fn) {
  reader = fn;
}

const parsed = new Map();
/** Loads and decodes a model file once: { metal: {slot: geo}, enamel: {colour: geo}, stones: [...], pearls, info }. */
function load(path) {
  if (!parsed.has(path))
    parsed.set(
      path,
      (async () => {
        // the loader is fetched only when a piece actually has a model, so the boutique stays light without them
        const [{ GLTFLoader }, { MeshoptDecoder }, buf] = await Promise.all([
          import('three/addons/loaders/GLTFLoader.js'),
          import('three/addons/libs/meshopt_decoder.module.js'),
          reader(path),
        ]);
        const loader = new GLTFLoader();
        loader.setMeshoptDecoder(MeshoptDecoder);
        const gltf = await loader.parseAsync(buf, '');
        gltf.scene.updateMatrixWorld(true);
        const out = { metal: {}, enamel: {}, stones: [], pearls: [], info: {} };
        gltf.scene.traverse((o) => {
          const ud = o.userData || {};
          if (ud.kanak) out.info = ud;
          if (ud.pearls) out.pearls = ud.pearls;
          if (!o.isMesh) return;
          // compressed files store positions as normalised integers: unpack to floats before moving them
          const g = toFloat(o.geometry);
          g.applyMatrix4(o.matrixWorld);
          const name = o.name || '';
          if (name.startsWith('metal-')) out.metal[name.slice(6)] = g;
          else if (name.startsWith('enamel-')) out.enamel['#' + name.slice(7)] = g;
          else if (name.startsWith('stones-')) out.stones.push(stoneGroup(name.slice(7), g, ud.stones || []));
        });
        parsed.set(path, out);
        return out;
      })().catch((e) => {
        parsed.delete(path);
        throw e;
      }),
    );
  return parsed.get(path);
}
/** A stone group: flat-faceted geometry with a facet id per triangle and each stone's frame per vertex. */
function stoneGroup(key, g, frames) {
  const kind = key.startsWith('kind-') ? key.slice(5) : '@' + key;
  const flat = g.index ? g.toNonIndexed() : g;
  for (const k of Object.keys(flat.attributes)) if (k !== 'position') flat.deleteAttribute(k);
  flat.computeVertexNormals(); // non-indexed: one normal per facet
  const n = flat.attributes.position.count;
  const facet = new Float32Array(n),
    sUp = new Float32Array(n * 3),
    sX = new Float32Array(n * 3);
  const glints = [];
  frames.forEach((f, si) => {
    const [t0, tn, ux, uy, uz, xx, xy, xz, cx, cy, cz, size] = f;
    for (let t = t0; t < t0 + tn; t++)
      for (let v = 0; v < 3; v++) {
        const i = t * 3 + v;
        if (i >= n) break;
        facet[i] = t - t0 + si * 37;
        sUp.set([ux, uy, uz], i * 3);
        sX.set([xx, xy, xz], i * 3);
      }
    glints.push({ pos: new THREE.Vector3(cx, cy, cz), size, up: new THREE.Vector3(ux, uy, uz) });
  });
  flat.setAttribute('facet', new THREE.BufferAttribute(facet, 1));
  flat.setAttribute('sUp', new THREE.BufferAttribute(sUp, 3));
  flat.setAttribute('sX', new THREE.BufferAttribute(sX, 3));
  return { kind, geo: flat, glints };
}
function toFloat(src) {
  const g = new THREE.BufferGeometry();
  for (const k in src.attributes) {
    const a = src.attributes[k];
    const out = new Float32Array(a.count * a.itemSize);
    for (let i = 0; i < a.count; i++)
      for (let c = 0; c < a.itemSize; c++) out[i * a.itemSize + c] = a.getComponent(i, c);
    g.setAttribute(k, new THREE.BufferAttribute(out, a.itemSize));
  }
  if (src.index) g.setIndex(src.index.clone());
  return g;
}
function cloneGeo(g) {
  const c = new THREE.BufferGeometry();
  for (const k in g.attributes) c.setAttribute(k, g.attributes[k].clone());
  if (g.index) c.setIndex(g.index.clone());
  return c;
}

/**
 * The Kit for a product with a model. bc: the build inputs (NY.buildCfg: ring and bangle sizes, chain length).
 * which: 'full' (viewer, try-on) or 'store' (the lighter file).
 */
export async function modelKit(p, bc, which) {
  const entry = manifest[p.id];
  const m = await load(which === 'store' ? entry.store : entry.file);
  const info = Object.assign({}, entry, m.info);
  // rings and bangles follow the chosen size: scale so the hole matches the size's inner diameter
  let s = 1;
  const inner = info.anchors && info.anchors.innerDia;
  if (inner && p.type === 'ring' && bc.ringDia) s = bc.ringDia / inner;
  if (inner && p.type === 'bangle' && bc.bangleDia) s = bc.bangleDia / inner;
  const piece = new Kit();
  piece.push(new THREE.Matrix4().makeScale(s, s, s));
  for (const slot in m.metal) piece.metalGeo(slot, cloneGeo(m.metal[slot]));
  for (const col in m.enamel) piece.enamelGeo(col, cloneGeo(m.enamel[col]));
  for (const st of m.stones)
    piece.stoneGeo(
      st.kind,
      cloneGeo(st.geo),
      st.glints.map((x) => ({ pos: x.pos.clone(), size: x.size, up: x.up.clone() })),
    );
  for (const [x, y, z, r] of m.pearls) piece.pearl('@pearl', r, [x, y, z]);
  piece.pop();
  for (const k in info.anchors || {}) piece.anchors[k] = info.anchors[k] * (k === 'innerDia' ? s : 1);
  piece.model = p.id;
  if (p.type === 'earrings') {
    // one earring in the file: a pair for the store and the viewer, the single one for the try-on
    const b = p.build || {};
    const gap = info.gap || (b.gap || 24) + (b.size || 0);
    const pair = new Kit();
    appendKit(pair, piece, new THREE.Matrix4().makeTranslation(-gap / 2, 0, 0));
    appendKit(pair, piece, new THREE.Matrix4().makeTranslation(gap / 2, 0, 0));
    pair.single = piece;
    pair.anchors = { bottom: piece.anchors.bottom, gap };
    pair.model = p.id;
    return pair;
  }
  if (p.type === 'pendant' && info.pendantOnly) {
    // a pendant on its own: hang it at the front of the chain the catalogue describes
    const chain = buildPiece(Object.assign({}, p.build, { pendant: null }), bc, which === 'store' ? 0.35 : 0.9);
    if (chain.path) {
      const f = chain.path.frame(0);
      const up = f.down.clone().negate();
      const at = f.p.clone().addScaledVector(f.n, 0.8);
      const fm = frameMatrix(at.toArray(), up.toArray(), f.t.toArray());
      // the frame's z is the outward normal: turn the pendant so its front faces out from the body
      const z = new THREE.Vector3().setFromMatrixColumn(fm, 2);
      if (z.dot(f.n) < 0) fm.multiply(new THREE.Matrix4().makeRotationY(Math.PI));
      appendKit(chain, piece, fm);
      chain.model = p.id;
      return chain;
    }
  }
  return piece;
}
