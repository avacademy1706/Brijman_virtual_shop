// Imported jewellery 3D models: "designer-style" files (metres, named materials, a ring on its side, a pair of
// earrings, an OBJ in centimetres) go through scripts/import-models.mjs and come back as kits that match the
// built-in pieces in size and position, keep their stones changeable, sparkle, and fit the triangle budgets.
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as THREE from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import { NY } from '../../src/core/ny.js';
import '../../src/data/catalogue.js';
import { buildPiece } from '../../src/jewel/build.js';
import { realize } from '../../src/jewel/kit.js';
import { useModels, setModelReader, modelKit } from '../../src/jewel/models.js';
import { pieceKit } from '../../src/jewel/source.js';
import { exportSampleModel } from '../../tools/sample-models.mjs';
import { importModels } from '../../scripts/import-models.mjs';

const dir = mkdtempSync(join(tmpdir(), 'kanak-models-'));
const src = join(dir, 'src'),
  out = join(dir, 'out'),
  manifestPath = join(dir, 'models.json');
let manifest = null;
const logs = [];

/** An OBJ file (centimetres) of a built-in piece's metal, the way some 3D tools export. */
function writeOBJ(pid, file) {
  const p = NY.byId[pid];
  const kit = buildPiece(p.build, NY.buildCfg(p, NY.defaultCfg(p)), 0.4);
  const lines = ['o ' + p.name, 'usemtl Gold'];
  let base = 1;
  for (const slot in kit.metal)
    for (const g0 of kit.metal[slot]) {
      const g = g0.index ? g0.toNonIndexed() : g0;
      const P = g.attributes.position.array;
      for (let i = 0; i < P.length; i += 3) lines.push('v ' + P[i] / 10 + ' ' + P[i + 1] / 10 + ' ' + P[i + 2] / 10);
      for (let t = 0; t < P.length / 9; t++)
        lines.push('f ' + (base + t * 3) + ' ' + (base + t * 3 + 1) + ' ' + (base + t * 3 + 2));
      base += P.length / 3;
    }
  writeFileSync(file, lines.join('\n'));
}

beforeAll(async () => {
  for (const id of ['s02', 'p03', 't02', 'p04']) await exportSampleModel(id, join(src, id + '.glb'));
  writeOBJ('e04', join(src, 'e04.obj'));
  manifest = await importModels({ src, out, manifest: manifestPath, log: (m) => logs.push(m), throw: true });
  useModels(manifest);
  setModelReader(async (path) => {
    const b = readFileSync(join(out, path.replace(/^jewellery\//, '')));
    return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
  });
}, 120_000);

// true bounds of the meshes (Kit.bounds() counts each built-in stone as a cube, which runs large)
const box = (kit) => new THREE.Box3().setFromObject(realize(kit, { env: {}, metal: 'y22', stones: {} }));
const near = (a, b, tol) => {
  for (const k of ['x', 'y', 'z']) {
    expect(Math.abs(a.min[k] - b.min[k]), 'min ' + k).toBeLessThan(tol);
    expect(Math.abs(a.max[k] - b.max[k]), 'max ' + k).toBeLessThan(tol);
  }
};
const kits = async (id, cfg) => {
  const p = NY.byId[id];
  const bc = NY.buildCfg(p, cfg || NY.defaultCfg(p));
  return { p, bc, model: await modelKit(p, bc, 'full'), ref: buildPiece(p.build, bc, 0.6) };
};

describe('import', () => {
  it('imports every file and lists it', () => {
    expect(Object.keys(manifest).sort()).toEqual(['e04', 'p03', 'p04', 's02', 't02']);
    for (const m of Object.values(manifest)) {
      expect(m.file).toMatch(/^jewellery\/\w+\.\w{10}\.glb$/);
      expect(m.store).toMatch(/\.store\.glb$/);
      expect(m.storeBytes).toBeLessThanOrEqual(m.bytes);
      expect(m.tris).toBeLessThanOrEqual(110000);
    }
  });
  it('detects the units', () => {
    expect(manifest.s02.unit).toBe('m');
    expect(manifest.e04.unit).toBe('cm');
  });
  it('turns a ring onto the finger axis and measures its hole', () => {
    const def = NY.sizesOf(NY.byId.s02).find((o) => o.id === NY.defaultSize(NY.byId.s02)).mm;
    expect(manifest.s02.anchors.innerDia).toBeGreaterThan(def - 0.8);
    expect(manifest.s02.anchors.innerDia).toBeLessThan(def + 0.8);
  });
  it('keeps one earring of a pair and remembers the spacing', () => {
    expect(manifest.p03.gap).toBeGreaterThan(20);
  });
  it('sorts stones into roles the shopper can change', () => {
    expect(manifest.s02.stones.map((s) => s.role).sort()).toEqual(['accent', 'main']);
    expect(manifest.t02.pearls).toBeGreaterThan(0);
  });
  it('keeps the store version within its triangle budget', () => {
    expect(manifest.s02.storeTris).toBeLessThanOrEqual(8000);
    expect(manifest.t02.storeTris).toBeLessThanOrEqual(26000);
  });
  it('skips unchanged files on the next run', async () => {
    const again = [];
    await importModels({ src, out, manifest: manifestPath, log: (m) => again.push(m) });
    expect(again.filter((m) => /up to date/.test(m))).toHaveLength(5);
  });
});

describe('models in the boutique', () => {
  it.each(['s02', 'e04', 't02', 'p04'])('%s sits where the built-in piece sits', async (id) => {
    const { model, ref } = await kits(id);
    near(box(model), box(ref), 2.5);
  });
  it('a pair of earrings, and a single one for the try-on', async () => {
    const { model, ref } = await kits('p03');
    expect(model.single).toBeTruthy();
    expect(model.anchors.gap).toBeGreaterThan(20);
    near(box(model), box(ref), 2.5);
  });
  it('a bigger ring size makes a bigger ring', async () => {
    const p = NY.byId.s02;
    const small = await modelKit(p, NY.buildCfg(p, { ...NY.defaultCfg(p), size: 8 }), 'full');
    const big = await modelKit(p, NY.buildCfg(p, { ...NY.defaultCfg(p), size: 22 }), 'full');
    expect(box(big).getSize(new THREE.Vector3()).x).toBeGreaterThan(box(small).getSize(new THREE.Vector3()).x);
  });
  it('stones follow the shopper choice and diamonds sparkle', async () => {
    const { model } = await kits('s02');
    const g = realize(model, { env: {}, metal: 'r18', stones: { main: 'ruby', accent: 'diamond' } });
    const names = g.children.map((c) => c.name);
    expect(names).toContain('stones-ruby');
    expect(names).toContain('stones-diamond');
    expect(names.some((n) => n.startsWith('metal-'))).toBe(true);
    expect(g.userData.glints.length).toBeGreaterThan(10);
    const stone = g.children.find((c) => c.name === 'stones-ruby');
    for (const k of ['facet', 'sUp', 'sX', 'normal']) expect(stone.geometry.attributes[k], k).toBeTruthy();
  });
  it('a missing model file falls back to the built-in piece', async () => {
    useModels({ e03: { ...manifest.s02, file: 'jewellery/missing.glb', store: 'jewellery/missing.glb' } });
    const p = NY.byId.e03;
    const warn = console.warn;
    console.warn = () => {};
    const kit = await pieceKit(p, NY.buildCfg(p, NY.defaultCfg(p)), 0.35);
    console.warn = warn;
    expect(kit.model).toBeUndefined();
    expect(kit.tris()).toBeGreaterThan(100);
  });
});
