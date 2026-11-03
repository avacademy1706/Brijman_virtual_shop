// Writes "designer-style" GLB files from built-in pieces, to test the model import without the client's files:
// metres instead of millimetres, named materials (Gold_22K, Diamond_Main, Ruby, Pearl...), stones and pearls as
// plain meshes, rings turned on their side. Used by tests/unit/models.test.js and by hand:
//   node tools/sample-models.mjs s02 p03 t02     -> models/jewellery/<id>.glb
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Document, NodeIO } from '@gltf-transform/core';
import * as THREE from 'three';
import { NY } from '../src/core/ny.js';
import '../src/data/catalogue.js';
import { buildPiece } from '../src/jewel/build.js';
import { gemGeometry } from '../src/jewel/gems.js';

const ROLE_NAME = { '@main': 'Main', '@accent': 'Halo', '@drop': 'Drop', '@side': 'Side', '@band': 'Band' };
const KIND_NAME = {
  diamond: 'Diamond',
  polki: 'Polki',
  kundan: 'Kundan',
  ruby: 'Ruby',
  emerald: 'Emerald',
  sapphire: 'Sapphire',
};

/** Builds the piece and writes it as a GLB the way a 3D artist might export it. Returns the file path. */
export async function exportSampleModel(pid, file, o = {}) {
  const p = NY.byId[pid];
  const cfg = NY.defaultCfg(p);
  const kit = buildPiece(p.build, NY.buildCfg(p, cfg), o.q || 0.6);
  const unit = o.unit == null ? 0.001 : o.unit; // metres by default
  const turn = new THREE.Matrix4().makeScale(unit, unit, unit);
  if (p.type === 'ring' && o.turn !== false) turn.premultiply(new THREE.Matrix4().makeRotationY(Math.PI / 2));
  const groups = new Map();
  const add = (name, g) => {
    g.applyMatrix4(turn);
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(g.index ? g.toNonIndexed() : g);
  };
  for (const slot in kit.metal)
    for (const g of kit.metal[slot])
      add(slot === 'w' ? 'WhiteGold_Prongs' : slot === 'ox' ? 'Oxidised_Recess' : 'Gold_22K', g.clone());
  for (const col in kit.enamel) for (const g of kit.enamel[col]) add('Enamel_' + col, g.clone());
  const stones = NY.stonesFor(p, cfg);
  for (const s of kit.gems) {
    const kind = s.kind[0] === '@' ? stones[s.kind.slice(1)] || 'diamond' : s.kind;
    const name = (KIND_NAME[kind] || 'Stone') + '_' + (ROLE_NAME[s.kind] || 'Fixed');
    const g = gemGeometry(s.cut).clone();
    g.deleteAttribute('facet');
    g.applyMatrix4(s.m);
    add(name, g);
  }
  for (const s of kit.pearls) {
    const g = new THREE.SphereGeometry(1, 16, 12);
    g.applyMatrix4(s.m);
    add('Pearl', g);
  }
  const doc = new Document();
  const buf = doc.createBuffer();
  const scene = doc.createScene();
  const top = doc.createNode(p.name);
  scene.addChild(top);
  for (const [name, list] of groups) {
    let n = 0;
    for (const g of list) n += g.attributes.position.count;
    const pos = new Float32Array(n * 3);
    let k = 0;
    for (const g of list) {
      pos.set(g.attributes.position.array, k);
      k += g.attributes.position.array.length;
    }
    const mat = doc.createMaterial(name).setMetallicFactor(/Gold|Prong|Recess/.test(name) ? 1 : 0);
    const prim = doc
      .createPrimitive()
      .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(pos).setBuffer(buf))
      .setMaterial(mat);
    top.addChild(doc.createNode(name).setMesh(doc.createMesh(name).addPrimitive(prim)));
  }
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, await new NodeIO().writeBinary(doc));
  return file;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  for (const id of process.argv.slice(2)) {
    const f = await exportSampleModel(id, join(root, 'models/jewellery', id + '.glb'));
    console.log('wrote', f);
  }
}
