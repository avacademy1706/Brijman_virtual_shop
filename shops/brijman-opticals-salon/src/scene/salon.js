// The salon itself: herringbone oak floor, pale stone walls, a wall of arched niches, white-marble islands with
// travertine blocks and bronze mushroom lamps, a drawer cabinet with a lit shelf unit, a navy velvet lounge,
// round floor mirrors, backlit posters and pampas in ribbed vases. Everything is procedural and batched by
// material (see batch.js). Returns the display slots the frames are placed on.
import * as THREE from 'three';

import { NY } from '../core/ny.js';
import '../data/store-layout.js';
import { rng } from './textures.js';

/* ---------- Materials ---------- */
export function salonMaterials(tex) {
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const basic = (o) => new THREE.MeshBasicMaterial(o);
  const phys = (o) => new THREE.MeshPhysicalMaterial(o);
  const shadowMat = (map, opacity) =>
    basic({
      map,
      color: 0x000000,
      transparent: true,
      opacity,
      depthWrite: false,
      toneMapped: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
  return {
    stone: std({ map: tex.stone, roughness: 0.46, color: '#ffffff' }),
    plaster: std({ map: tex.plaster, roughness: 0.9, color: '#f1ebe2' }),
    ceil: std({ map: tex.plaster, color: '#f6f2ec', roughness: 1, emissive: '#f2ede5', emissiveIntensity: 0.32 }),
    marble: std({ map: tex.marble, roughness: 0.16, color: '#ffffff' }),
    greige: std({ map: tex.greige, roughness: 0.66, color: '#ffffff' }),
    oak: std({ map: tex.oak, roughness: 0.6, color: '#efe4d3' }),
    travertine: std({ map: tex.travertine, roughness: 0.72, color: '#ffffff' }),
    lacquer: std({ color: '#f4f1ec', roughness: 0.34 }),
    lacquerLit: std({ color: '#f6f3ee', roughness: 0.4, emissive: '#fff6ea', emissiveIntensity: 0.28 }),
    trim: std({ color: '#bca98e', metalness: 0.55, roughness: 0.36 }),
    bronze: std({ color: '#4a4039', metalness: 0.72, roughness: 0.4 }),
    velvet: phys({
      color: '#1d2942',
      roughness: 0.82,
      sheen: 1,
      sheenColor: new THREE.Color('#5a6fa6'),
      sheenRoughness: 0.42,
    }),
    boucle: std({ map: tex.boucle, roughness: 1, color: '#ddd3c4' }),
    linen: std({
      map: tex.linen,
      color: '#ffffff',
      roughness: 0.92,
      emissive: '#ffffff',
      emissiveMap: tex.glow,
      emissiveIntensity: 0.42,
    }),
    reveal: std({ map: tex.linen, color: '#efe5d8', roughness: 0.92, emissive: '#f3e8da', emissiveIntensity: 0.12 }),
    glow: basic({ color: '#fff3e0', toneMapped: false }),
    lampGlow: basic({ color: '#ffe2b8', toneMapped: false }),
    dark: std({ color: '#2a2622', roughness: 0.85 }),
    ceramic: std({ color: '#8f8880', roughness: 0.82 }),
    stem: std({ color: '#c2ab88', roughness: 0.85 }),
    plume: std({
      map: tex.plume,
      color: '#e9dcc4',
      roughness: 1,
      transparent: true,
      alphaTest: 0.04,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
    bookA: std({ color: '#9a8a74', roughness: 0.8 }),
    bookB: std({ color: '#26324a', roughness: 0.75 }),
    bookC: std({ color: '#e2d8c8', roughness: 0.8 }),
    screen: basic({ color: '#11161a' }),
    mirror: std({ color: '#eef1f1', metalness: 1, roughness: 0.03 }),
    glass: phys({
      color: '#ffffff',
      transparent: true,
      opacity: 0.12,
      roughness: 0.03,
      metalness: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
    glassware: phys({
      color: '#f2f7f6',
      transparent: true,
      opacity: 0.3,
      roughness: 0.04,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
    lensDisc: phys({ color: '#e9f3f2', transparent: true, opacity: 0.5, roughness: 0.05, depthWrite: false }),
    pool: basic({
      map: tex.pool,
      transparent: true,
      opacity: 0.34,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
    }),
    outside: basic({ color: '#e9e4dc' }),
    pavement: std({ color: '#d4d0c8', roughness: 0.92 }),
    shRect: shadowMat(tex.sRect, 0.38),
    shRound: shadowMat(tex.sRound, 0.36),
    shEdge: shadowMat(tex.sEdge, 0.16),
  };
}
/** Per material: solid (blocks the walk ray and hover), cast / receive shadows, draw order. */
export const SALON_BATCH = {
  stone: { receive: true },
  plaster: { receive: true },
  ceil: { solid: false },
  marble: { cast: true, receive: true },
  greige: { cast: true, receive: true },
  oak: { cast: true },
  travertine: { cast: true, receive: true },
  lacquer: { cast: true, receive: true },
  lacquerLit: { receive: true },
  trim: { cast: true },
  bronze: { cast: true },
  velvet: { cast: true, receive: true },
  boucle: { receive: true },
  linen: { receive: true },
  reveal: { receive: true },
  glow: {},
  lampGlow: {},
  dark: {},
  ceramic: { cast: true, receive: true },
  stem: { cast: true },
  plume: { order: 2 },
  bookA: { cast: true },
  bookB: { cast: true },
  bookC: { cast: true },
  screen: {},
  mirror: {},
  glass: { solid: false, order: 3 },
  glassware: { solid: false, order: 3 },
  lensDisc: { solid: false, order: 3 },
  pool: { solid: false, order: 2 },
  outside: { solid: false },
  pavement: { solid: false },
  shRect: { solid: false, order: 1 },
  shRound: { solid: false, order: 1 },
  shEdge: { solid: false, order: 1 },
};

/* ---------- Geometry helpers ---------- */
/** A stadium (pill) outline: width w, from y0 to y1, centred on x. */
function pill(P, cx, y0, y1, w) {
  const r = w / 2;
  const p = new P();
  p.moveTo(cx + r, y0 + r);
  p.lineTo(cx + r, y1 - r);
  p.absarc(cx, y1 - r, r, 0, Math.PI, false);
  p.lineTo(cx - r, y0 + r);
  p.absarc(cx, y0 + r, r, Math.PI, Math.PI * 2, false);
  return p;
}
/** A rounded rectangle outline. */
function rrect(P, x0, y0, x1, y1, r) {
  const p = new P();
  p.moveTo(x0 + r, y0);
  p.lineTo(x1 - r, y0);
  p.absarc(x1 - r, y0 + r, r, -Math.PI / 2, 0, false);
  p.lineTo(x1, y1 - r);
  p.absarc(x1 - r, y1 - r, r, 0, Math.PI / 2, false);
  p.lineTo(x0 + r, y1);
  p.absarc(x0 + r, y1 - r, r, Math.PI / 2, Math.PI, false);
  p.lineTo(x0, y0 + r);
  p.absarc(x0 + r, y0 + r, r, Math.PI, Math.PI * 1.5, false);
  return p;
}
/** Splits an ExtrudeGeometry into its caps (faces) and its sides (edges and the walls of the holes). */
function splitExtrude(g) {
  const out = [];
  for (const grp of g.groups) {
    const part = new THREE.BufferGeometry();
    for (const k of ['position', 'normal', 'uv']) {
      const a = g.attributes[k];
      part.setAttribute(
        k,
        new THREE.BufferAttribute(
          a.array.slice(grp.start * a.itemSize, (grp.start + grp.count) * a.itemSize),
          a.itemSize,
        ),
      );
    }
    out[grp.materialIndex] = part;
  }
  return out;
}
const scaleUV = (g, k) => {
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / k, uv.getY(i) / k);
  return g;
};

/* ---------- The salon ---------- */
export function buildSalon(ctx) {
  const { B, M, tex, scene } = ctx;
  const L = NY.L,
    H = L.H;
  const V3 = THREE.Vector3;
  const slots = { women: [], men: [], sunA: [], sunB: [], atelier: [], plinths: [], kids: [] };
  const contacts = { upper: [], lower: [] };
  const mirrors = [];
  const W = L.x1 - L.x0,
    D = L.z1 - L.z0;
  const shadowRect = (x, z, w, d) => B.plane('shRect', w, d, x, 0.006, z, -Math.PI / 2);
  const shadowRound = (x, z, s) => B.plane('shRound', s, s, x, 0.006, z, -Math.PI / 2);
  /** A mesh with its own material, placed in the current batch frame. */
  const own = (geo, mat, x, y, z, o) => {
    const m = new THREE.Mesh(geo, mat);
    m.applyMatrix4(B.F.clone().multiply(new THREE.Matrix4().makeTranslation(x, y, z)));
    if (o && o.order != null) m.renderOrder = o.order;
    m.matrixAutoUpdate = false;
    m.updateMatrix();
    scene.add(m);
    return m;
  };

  /* Floor: herringbone oak at 45 degrees */
  {
    const g = new THREE.PlaneGeometry(W, D, 1, 1);
    g.rotateX(-Math.PI / 2);
    g.translate((L.x0 + L.x1) / 2, 0, (L.z0 + L.z1) / 2);
    const pos = g.attributes.position,
      uv = g.attributes.uv,
      c = Math.SQRT1_2,
      tile = 3.6;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i),
        z = pos.getZ(i);
      uv.setXY(i, (x * c + z * c) / tile, (-x * c + z * c) / tile);
    }
    const floor = new THREE.Mesh(
      g,
      new THREE.MeshStandardMaterial({ map: tex.floor, roughness: 0.5, color: '#ffffff' }),
    );
    floor.receiveShadow = true;
    floor.name = 'floor';
    scene.add(floor);
    ctx.floor = floor;
  }

  /* Shell: back wall, structural side walls, ceiling, cove light and the glass front */
  B.box('stone', W, H, 0.1, 0, H / 2, L.z0 - 0.05, { uvs: 2.6 });
  B.box('stone', 0.1, H, D, L.x0 - 0.05, H / 2, 0, { uvs: 2.6 });
  B.box('plaster', 0.1, H, D, L.x1 + 0.05, H / 2, 0, { uvs: 2.6 });
  B.plane('shEdge', W, 0.3, 0, 0.004, L.z0 + 0.15, -Math.PI / 2);
  B.plane('ceil', W, D, 0, H, 0, Math.PI / 2, 0, 3);
  // shadow gap at the ceiling edge and a wall-washing cove
  B.box('glow', W - 0.8, 0.012, 0.02, 0, H - 0.02, L.z0 + 0.06);
  for (const x of [L.x0 + L.wall + 0.06, L.x1 - L.wall - 0.06]) B.box('glow', 0.02, 0.012, D - 0.6, x, H - 0.02, 0);
  // linear lights over the islands, downlights over the aisles
  B.box('glow', 2.6, 0.01, 0.05, L.islandA.x, H - 0.006, L.islandA.z);
  B.box('dark', 2.7, 0.006, 0.11, L.islandA.x, H - 0.002, L.islandA.z);
  B.box('glow', 2.2, 0.01, 0.05, L.islandB.x, H - 0.006, L.islandB.z);
  B.box('dark', 2.3, 0.006, 0.11, L.islandB.x, H - 0.002, L.islandB.z);
  {
    const pos = [];
    for (const x of [-4.5, -2.4, 2.7, 4.5]) for (const z of [-4.6, -2.3, 0, 2.3, 4.6]) pos.push([x, z]);
    for (const x of [-0.4]) for (const z of [-4.3, 4.4]) pos.push([x, z]);
    const g = new THREE.CircleGeometry(0.05, 20);
    g.rotateX(Math.PI / 2);
    const im = new THREE.InstancedMesh(g, M.glow, pos.length);
    const g2 = new THREE.CircleGeometry(0.075, 24);
    g2.rotateX(Math.PI / 2);
    const im2 = new THREE.InstancedMesh(g2, M.dark, pos.length);
    const m = new THREE.Matrix4();
    pos.forEach((p, i) => {
      im.setMatrixAt(i, m.makeTranslation(p[0], H - 0.004, p[1]));
      im2.setMatrixAt(i, m.makeTranslation(p[0], H - 0.002, p[1]));
    });
    scene.add(im2, im);
  }
  // glass front with slim bronze mullions and a door opening
  {
    const gH = H - 0.42;
    B.box('bronze', W, 0.42, 0.12, 0, H - 0.21, L.z1 + 0.02);
    B.box('bronze', W, 0.05, 0.1, 0, 0.025, L.z1 + 0.02);
    for (const seg of [
      [L.x0, -L.door],
      [L.door, L.x1],
    ]) {
      const w = seg[1] - seg[0];
      B.plane('glass', w, gH - 0.05, (seg[0] + seg[1]) / 2, 0.05 + (gH - 0.05) / 2, L.z1 + 0.02);
      const n = Math.max(1, Math.round(w / 1.6));
      for (let i = 0; i <= n; i++) B.box('bronze', 0.04, gH, 0.1, seg[0] + (w * i) / n, gH / 2, L.z1 + 0.02);
    }
    B.plane('pavement', 40, 18, 0, -0.02, L.z1 + 9, -Math.PI / 2);
    B.plane('outside', 50, 20, 0, 6, L.z1 + 14, 0, Math.PI);
    // the wordmark over the door, inside
    const wm = new THREE.Mesh(
      new THREE.PlaneGeometry(1.9, 0.41),
      new THREE.MeshBasicMaterial({ map: tex.wordmark, transparent: true, depthWrite: false }),
    );
    wm.position.set(0, H - 0.21, L.z1 - 0.05);
    wm.rotation.y = Math.PI;
    wm.renderOrder = 1;
    scene.add(wm);
  }

  /* Right wall: eight arched niches recessed into a 0.3 m false wall, champagne rims, lacquer shelves */
  {
    const N = L.niches,
      t = L.wall;
    B.push(L.x1 - t, 0, -Math.PI / 2); // local x = world z, local +z = into the room
    const outline = new THREE.Shape();
    outline.moveTo(L.z0, 0);
    outline.lineTo(L.z1, 0);
    outline.lineTo(L.z1, H);
    outline.lineTo(L.z0, H);
    outline.lineTo(L.z0, 0);
    for (const zc of N.zs) outline.holes.push(pill(THREE.Path, zc, N.y0, N.y1, N.w));
    const ex = new THREE.ExtrudeGeometry(outline, { depth: N.depth, bevelEnabled: false, curveSegments: 20 });
    ex.translate(0, 0, -N.depth);
    const [caps, sides] = splitExtrude(ex);
    B.geo('plaster', scaleUV(caps, 2.6));
    B.geo('reveal', scaleUV(sides, 0.5));
    // backs of the recesses, lit from the top
    for (const zc of N.zs) {
      const bg = new THREE.PlaneGeometry(N.w + 0.02, N.y1 - N.y0 + 0.02);
      const uv = bg.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2, uv.getY(i));
      bg.translate(zc, (N.y0 + N.y1) / 2, -N.depth + 0.003);
      B.geo('linen', bg);
      // rim
      const ring = pill(THREE.Shape, zc, N.y0 - 0.026, N.y1 + 0.026, N.w + 0.052);
      ring.holes.push(pill(THREE.Path, zc, N.y0, N.y1, N.w));
      B.geo('trim', new THREE.ExtrudeGeometry(ring, { depth: 0.014, bevelEnabled: false, curveSegments: 20 }));
      // LED under the top arch
      B.box('glow', N.w * 0.5, 0.006, 0.01, zc, N.y1 - N.w * 0.36, -0.05);
      // shelves, one frame each
      const sh = [];
      for (const y of L.nicheShelves) {
        B.box('lacquer', N.w - 0.006, 0.014, N.depth - 0.03, zc, y - 0.007, -N.depth / 2 - 0.012);
        sh.push({ pos: B.local(zc, y, -0.085), ry: -Math.PI / 2 });
      }
      (zc < -0.85 ? slots.women : slots.men).push(sh.reverse()); // top shelf first
      shadowRect(L.x1 - t - 0.06, zc, 0.3, N.w + 0.25);
    }
    // slender fins hanging from the ceiling between the niches
    const fx = [N.zs[0] - 0.56, ...N.zs.map((z) => z + 0.56)];
    for (const x of fx) B.box('oak', 0.032, H - 2.8, 0.26, x, (H + 2.8) / 2, 0.13);
    B.pop();
  }

  /* Left wall: a false wall in pale stone with the kids' niche at a child's eye level */
  {
    const K = L.kids,
      t = L.wall;
    B.push(L.x0 + t, 0, Math.PI / 2); // local x = -world z, local +z = into the room
    const lx = -K.z;
    const outline = new THREE.Shape();
    outline.moveTo(-L.z1, 0);
    outline.lineTo(-L.z0, 0);
    outline.lineTo(-L.z0, H);
    outline.lineTo(-L.z1, H);
    outline.lineTo(-L.z1, 0);
    outline.holes.push(rrect(THREE.Path, lx - K.w / 2, K.y0, lx + K.w / 2, K.y1, 0.2));
    const ex = new THREE.ExtrudeGeometry(outline, { depth: t, bevelEnabled: false, curveSegments: 10 });
    ex.translate(0, 0, -t);
    const [caps, sides] = splitExtrude(ex);
    B.geo('stone', scaleUV(caps, 2.6));
    B.geo('reveal', scaleUV(sides, 0.5));
    const bg = new THREE.PlaneGeometry(K.w + 0.02, K.y1 - K.y0 + 0.02);
    const uv = bg.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 6, uv.getY(i));
    bg.translate(lx, (K.y0 + K.y1) / 2, -t + 0.004);
    B.geo('linen', bg);
    const ring = rrect(THREE.Shape, lx - K.w / 2 - 0.026, K.y0 - 0.026, lx + K.w / 2 + 0.026, K.y1 + 0.026, 0.226);
    ring.holes.push(rrect(THREE.Path, lx - K.w / 2, K.y0, lx + K.w / 2, K.y1, 0.2));
    B.geo('trim', new THREE.ExtrudeGeometry(ring, { depth: 0.014, bevelEnabled: false, curveSegments: 10 }));
    B.box('glow', K.w - 0.4, 0.006, 0.01, lx, K.y1 - 0.03, -0.05);
    const rows = [];
    for (const y of K.shelves) {
      B.box('lacquer', K.w - 0.01, 0.016, t - 0.04, lx, y - 0.008, -t / 2 - 0.015);
      const row = [];
      for (let i = 0; i < K.slots; i++)
        row.push({ pos: B.local(lx + (i - (K.slots - 1) / 2) * 0.48, y, -0.12), ry: Math.PI / 2 });
      rows.push(row);
    }
    rows.reverse(); // top shelf first
    for (const r of rows) slots.kids.push(...r);
    B.pop();
  }
  // soft contact shadows where the false walls meet the floor
  B.plane('shEdge', D, 0.26, L.x0 + L.wall + 0.13, 0.004, 0, -Math.PI / 2, -Math.PI / 2);
  B.plane('shEdge', D, 0.26, L.x1 - L.wall - 0.13, 0.004, 0, -Math.PI / 2, Math.PI / 2);

  /* Backlit posters (lightboxes) */
  for (const p of L.posters) {
    B.push(p.x, p.z, p.ry);
    B.box('trim', p.w + 0.06, p.h + 0.06, 0.045, 0, p.y, 0.0225);
    B.box('dark', p.w + 0.01, p.h + 0.01, 0.01, 0, p.y, 0.041);
    own(
      new THREE.PlaneGeometry(p.w, p.h),
      new THREE.MeshBasicMaterial({ map: tex.posters[p.id], toneMapped: false }),
      0,
      p.y,
      0.047,
    );
    B.plane('pool', p.w * 1.8, 1.0, 0, 0.007, 0.5, -Math.PI / 2);
    B.pop();
  }

  /* Mushroom lamp in dark bronze, with a warm pool of light on the marble under it */
  function lamp(x, y, z, s) {
    s = s || 1;
    // profile from the underside centre, out to the rim and back over the top (outward normals)
    const prof = [
      [0.0, 0.048],
      [0.03, 0.048],
      [0.08, 0.044],
      [0.15, 0.032],
      [0.188, 0.024],
      [0.196, 0.038],
      [0.19, 0.066],
      [0.17, 0.106],
      [0.13, 0.142],
      [0.07, 0.164],
      [0.0, 0.17],
    ].map((q) => new THREE.Vector2(q[0] * s, q[1] * s));
    const stemH = 0.3 * s;
    const dome = new THREE.LatheGeometry(prof, 40);
    dome.translate(x, y + stemH, z);
    B.geo('bronze', dome);
    B.cyl('bronze', 0.026 * s, 0.032 * s, stemH, x, y + stemH / 2, z, 16);
    B.cyl('bronze', 0.1 * s, 0.104 * s, 0.018, x, y + 0.009, z, 32);
    const gl = new THREE.CircleGeometry(0.11 * s, 28);
    gl.rotateX(Math.PI / 2);
    gl.translate(x, y + stemH + 0.03 * s, z);
    B.geo('lampGlow', gl);
    B.plane('pool', 0.95 * s, 0.95 * s, x, y + 0.003, z, -Math.PI / 2);
  }
  /** A travertine block for one pair, returns the slot on top. */
  function block(x, top, z, w, d, ry) {
    B.box('travertine', w || 0.21, 0.045, d || 0.12, x, top + 0.0225, z, { uvs: 0.4 });
    return { pos: B.local(x, top + 0.045, z), ry: ry || 0 };
  }

  /* Island A: the sunglasses salon. Greige base with panel joints, a white-marble top, travertine blocks */
  {
    const A = L.islandA,
      h = A.h;
    B.push(A.x, A.z, 0);
    B.box('dark', A.w - 0.16, 0.07, A.d - 0.16, 0, 0.035, 0);
    B.box('greige', A.w - 0.08, h - 0.13, A.d - 0.08, 0, 0.07 + (h - 0.13) / 2, 0, { uvs: 1.2 });
    for (let x = -A.w / 2 + 0.5; x < A.w / 2 - 0.1; x += 0.5)
      for (const sz of [1, -1]) B.box('dark', 0.006, h - 0.16, 0.004, x, 0.07 + (h - 0.13) / 2, sz * (A.d / 2 - 0.038));
    B.box('marble', A.w, 0.06, A.d, 0, h - 0.03, 0, { uvs: 1.5 });
    const lx = -0.5,
      lz = -0.3;
    lamp(lx, h, lz, 1);
    for (const z of [-0.45, -0.15, 0.15, 0.45])
      for (let i = 0; i < 6; i++) {
        const x = -1.25 + i * 0.5;
        if (Math.abs(x - lx) < 0.3 && Math.abs(z - lz) < 0.2) continue;
        slots.sunA.push(block(x, h, z));
      }
    shadowRect(0, 0, A.w + 0.4, A.d + 0.4);
    B.pop();
  }

  /* The marble counter joined to island A: lens samples, contact lenses and care, checkout, pampas */
  {
    const C = L.counter,
      h = C.h;
    B.push(C.x, C.z, 0);
    B.box('dark', C.w - 0.06, 0.05, C.d - 0.06, 0, 0.025, 0);
    B.box('marble', C.w, h - 0.05, C.d, 0, 0.05 + (h - 0.05) / 2, 0, { uvs: 1.5 });
    // a two-step travertine riser, customer side (+x)
    B.box('travertine', 0.17, 0.05, 1.02, 0.36, h + 0.025, 0.24, { uvs: 0.5 });
    B.box('travertine', 0.17, 0.13, 1.02, 0.18, h + 0.065, 0.24, { uvs: 0.5 });
    for (let i = 0; i < 4; i++)
      contacts.upper.push({ pos: B.local(0.2, h + 0.13, -0.135 + i * 0.25), ry: Math.PI / 2 });
    for (let i = 0; i < 3; i++)
      contacts.lower.push({ pos: B.local(0.37, h + 0.05, -0.09 + i * 0.33), ry: Math.PI / 2 });
    // lens sample tray
    B.box('bronze', 0.34, 0.014, 0.24, 0.28, h + 0.007, -0.78);
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 2; j++)
        B.cyl('lensDisc', 0.032, 0.032, 0.005, 0.2 + j * 0.15, h + 0.017, -0.89 + i * 0.075, 28);
    B.hitbox('lensguide', 0.28, h + 0.1, -0.78, 0.4, 0.25, 0.32);
    // checkout tablet on a stand, facing the customer
    B.box('bronze', 0.05, 0.12, 0.05, -0.1, h + 0.06, -0.86);
    B.box('dark', 0.025, 0.2, 0.3, -0.07, h + 0.17, -0.86, { rz: -0.35 });
    B.box('screen', 0.004, 0.18, 0.27, -0.054, h + 0.177, -0.86, { rz: -0.35 });
    B.hitbox('bag', -0.06, h + 0.15, -0.86, 0.3, 0.3, 0.38);
    // carafe and a glass
    const carafe = new THREE.LatheGeometry(
      [
        [0, 0],
        [0.05, 0],
        [0.056, 0.02],
        [0.056, 0.13],
        [0.03, 0.18],
        [0.022, 0.24],
        [0.026, 0.25],
      ].map((q) => new THREE.Vector2(q[0], q[1])),
      28,
    );
    carafe.translate(0.3, h, 0.82);
    B.geo('glassware', carafe);
    const glass = new THREE.LatheGeometry(
      [
        [0, 0],
        [0.03, 0],
        [0.034, 0.09],
      ].map((q) => new THREE.Vector2(q[0], q[1])),
      24,
    );
    glass.translate(0.38, h, 0.66);
    B.geo('glassware', glass);
    vase(0.02, h, 0.86, 0.72, 4);
    shadowRect(0, 0, C.w + 0.4, C.d + 0.4);
    B.pop();
  }

  /* Island B: raised drawer island with the polarised edit, a lamp and a small table mirror */
  {
    const I = L.islandB,
      h = I.h;
    B.push(I.x, I.z, 0);
    B.box('dark', I.w - 0.12, 0.06, I.d - 0.12, 0, 0.03, 0);
    B.box('greige', I.w - 0.06, h - 0.11, I.d - 0.06, 0, 0.06 + (h - 0.11) / 2, 0, { uvs: 1.2 });
    drawers(I.w - 0.06, 0.06, h - 0.05, (I.d - 0.06) / 2, 4, 3);
    B.box('marble', I.w, 0.05, I.d, 0, h - 0.025, 0, { uvs: 1.5 });
    lamp(-1.0, h, 0, 0.9);
    for (const z of [-0.2, 0.2]) for (const x of [-0.45, 0.0, 0.45, 0.9]) slots.sunB.push(block(x, h, z));
    // table mirror
    B.cyl('bronze', 0.07, 0.075, 0.014, 1.15, h + 0.007, 0, 24);
    B.cyl('bronze', 0.008, 0.008, 0.24, 1.15, h + 0.12, 0, 8);
    const md = new THREE.CircleGeometry(0.13, 40);
    md.translate(1.15, h + 0.36, 0.012);
    mirrors.push(B.geo('mirror', md));
    B.torus('trim', 0.132, 0.008, 1.15, h + 0.36, 0.012, 0, 40);
    B.cyl('trim', 0.132, 0.132, 0.01, 1.15, h + 0.36, 0.004, 40, { rx: Math.PI / 2 });
    shadowRect(0, 0, I.w + 0.4, I.d + 0.4);
    B.pop();
  }
  /** Drawer fronts with joints and small bronze pulls on both long faces (local frame of the piece). */
  function drawers(w, y0, y1, zf, cols, rows) {
    const hh = y1 - y0;
    for (const sz of [1, -1]) {
      const z = sz * (zf + 0.002);
      for (let r = 1; r < rows; r++) B.box('dark', w - 0.02, 0.005, 0.004, 0, y0 + (hh * r) / rows, z);
      for (let c = 1; c < cols; c++) B.box('dark', 0.005, hh - 0.02, 0.004, -w / 2 + (w * c) / cols, y0 + hh / 2, z);
      for (let r = 0; r < rows; r++)
        for (let c = 0; c < cols; c++)
          B.box(
            'bronze',
            0.11,
            0.01,
            0.018,
            -w / 2 + (w * (c + 0.5)) / cols,
            y0 + (hh * (r + 1)) / rows - 0.05,
            z + sz * 0.009,
          );
    }
  }

  /* Back wall: drawer cabinet with travertine plinths, and the lit white shelf unit above it */
  {
    const Hc = L.hutch,
      h = Hc.h;
    B.push(Hc.x, L.z0, 0);
    B.box('dark', Hc.w - 0.04, 0.06, Hc.d - 0.04, 0, 0.03, Hc.d / 2 - 0.02);
    B.box('greige', Hc.w, h - 0.06, Hc.d, 0, 0.06 + (h - 0.06) / 2, Hc.d / 2, { uvs: 1.2 });
    // drawers on the front only
    {
      const z = Hc.d + 0.002,
        hh = h - 0.06;
      B.box('dark', Hc.w - 0.02, 0.005, 0.004, 0, 0.06 + hh / 2, z);
      for (let c = 1; c < 4; c++) B.box('dark', 0.005, hh - 0.02, 0.004, -Hc.w / 2 + (Hc.w * c) / 4, 0.06 + hh / 2, z);
      for (let r = 0; r < 2; r++)
        for (let c = 0; c < 4; c++)
          B.box(
            'bronze',
            0.14,
            0.01,
            0.018,
            -Hc.w / 2 + (Hc.w * (c + 0.5)) / 4,
            0.06 + (hh * (r + 1)) / 2 - 0.06,
            z + 0.009,
          );
    }
    B.box('marble', Hc.w + 0.03, 0.04, Hc.d + 0.03, 0, h + 0.02, Hc.d / 2, { uvs: 1.5 });
    for (let i = 0; i < 6; i++) {
      const x = -Hc.w / 2 + 0.27 + (i * (Hc.w - 0.54)) / 5;
      B.box('travertine', 0.24, 0.09, 0.17, x, h + 0.04 + 0.045, Hc.d / 2 + 0.04, { uvs: 0.4 });
      slots.plinths.push({ pos: B.local(x, h + 0.04 + 0.09, Hc.d / 2 + 0.06), ry: 0 });
    }
    const [p0, p1] = Hc.panel,
      uw = Hc.w - 0.1;
    B.box('lacquerLit', uw, p1 - p0, 0.025, 0, (p0 + p1) / 2, 0.0125);
    for (const sx of [-1, 1])
      B.box('lacquer', 0.025, p1 - p0 + 0.05, 0.27, sx * (uw / 2 - 0.0125), (p0 + p1) / 2 + 0.025, 0.135);
    B.box('lacquer', uw, 0.05, 0.28, 0, p1 + 0.025, 0.14);
    B.box('glow', uw - 0.1, 0.006, 0.012, 0, p1 - 0.004, 0.23);
    for (const y of Hc.shelves) {
      B.box('lacquer', uw - 0.05, 0.016, 0.24, 0, y - 0.008, 0.145);
      const row = [];
      for (let i = 0; i < Hc.slots; i++)
        row.push({ pos: B.local(-(uw - 0.3) / 2 + ((i + 0.5) * (uw - 0.3)) / Hc.slots, y, 0.2), ry: 0 });
      slots.atelier.push(row);
    }
    slots.atelier.reverse(); // top shelf first
    own(
      new THREE.PlaneGeometry(2.0, 0.43),
      new THREE.MeshBasicMaterial({ map: tex.wordmark, transparent: true, depthWrite: false }),
      0,
      2.86,
      0.006,
      { order: 1 },
    );
    shadowRect(0, Hc.d / 2 + 0.12, Hc.w + 0.3, Hc.d + 0.4);
    B.pop();
  }

  /* Lounge: boucle rug, two navy velvet barrel chairs, a travertine side table with books and a sculpture */
  {
    const lg = L.lounge;
    const rug = new THREE.CircleGeometry(lg.rug.r, 72);
    const uv = rug.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2.2, uv.getY(i) * 2.2);
    rug.rotateX(-Math.PI / 2);
    rug.translate(lg.rug.x, 0.005, lg.rug.z);
    B.geo('boucle', rug);
    const T = lg.table;
    B.cyl('travertine', T.r, T.r, 0.04, T.x, 0.52, T.z, 40);
    B.cyl('travertine', 0.13, 0.16, 0.5, T.x, 0.25, T.z, 32);
    B.box('bookB', 0.22, 0.026, 0.16, T.x - 0.02, 0.553, T.z + 0.03, { ry: 0.3 });
    B.box('bookC', 0.19, 0.022, 0.14, T.x - 0.01, 0.577, T.z + 0.02, { ry: 0.12 });
    B.box('bookA', 0.17, 0.02, 0.13, T.x, 0.598, T.z + 0.02, { ry: -0.15 });
    B.cyl('bronze', 0.03, 0.035, 0.05, T.x + 0.14, 0.565, T.z - 0.1, 16);
    B.sph('bronze', 0.045, T.x + 0.14, 0.63, T.z - 0.1, 1, 1.15, 1, 20);
    shadowRound(T.x, T.z, 0.85);
    for (const ch of lg.chairs) chair(ch.x, ch.z, Math.atan2(ch.face[0] - ch.x, ch.face[1] - ch.z));
  }
  function chair(x, z, yaw) {
    B.push(x, z, yaw);
    const Ro = 0.38,
      Ri = 0.27,
      open = 2.05,
      rc = (Ro - Ri) / 2,
      rm = (Ro + Ri) / 2;
    // plan shape in (x, -z); the opening faces local +z
    const a0 = -Math.PI / 2 + open / 2,
      a1 = -Math.PI / 2 - open / 2 + Math.PI * 2;
    const s = new THREE.Shape();
    s.moveTo(Math.cos(a0) * Ro, Math.sin(a0) * Ro);
    s.absarc(0, 0, Ro, a0, a1, false);
    s.absarc(Math.cos(a1) * rm, Math.sin(a1) * rm, rc, a1, a1 + Math.PI, false);
    s.absarc(0, 0, Ri, a1, a0, true);
    s.absarc(Math.cos(a0) * rm, Math.sin(a0) * rm, rc, a0 + Math.PI, a0 + Math.PI * 2, false);
    // in this plan, +y is towards the back (world -z); flip so the opening faces +z after rotateX
    const g = new THREE.ExtrudeGeometry(s, {
      depth: 0.56,
      bevelEnabled: true,
      bevelThickness: 0.045,
      bevelSize: 0.04,
      bevelSegments: 5,
      curveSegments: 40,
    });
    g.rotateX(-Math.PI / 2);
    g.translate(0, 0.12, 0);
    // arms lower than the back
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const px = pos.getX(i),
        py = pos.getY(i),
        pz = pos.getZ(i);
      if (py <= 0.42) continue;
      const front = Math.atan2(px, pz); // 0 = front (+z)
      const f = (1 - Math.cos(front)) / 2;
      pos.setY(i, 0.42 + (py - 0.42) * (0.66 + 0.34 * f));
    }
    g.computeVertexNormals();
    B.geo('velvet', g);
    // seat cushion
    const seat = new THREE.LatheGeometry(
      [
        [0, 0],
        [0.27, 0],
        [0.29, 0.02],
        [0.3, 0.07],
        [0.29, 0.12],
        [0.26, 0.14],
        [0, 0.145],
      ].map((q) => new THREE.Vector2(q[0], q[1])),
      40,
    );
    seat.translate(0, 0.34, 0.03);
    B.geo('velvet', seat);
    B.cyl('dark', 0.3, 0.3, 0.075, 0, 0.0375, 0, 32);
    shadowRound(0, 0.02, 1.05);
    B.pop();
  }

  /* Round floor mirrors on a slim stand */
  for (const m of L.mirrors) {
    B.push(m.x, m.z, m.ry);
    B.cyl('bronze', 0.19, 0.2, 0.025, 0, 0.0125, 0, 32);
    B.cyl('bronze', 0.012, 0.012, 1.42, 0, 0.71, -0.03, 10);
    const md = new THREE.CircleGeometry(0.38, 64);
    md.translate(0, 1.42, 0.012);
    mirrors.push(B.geo('mirror', md));
    B.torus('trim', 0.385, 0.012, 0, 1.42, 0.012, 0, 72);
    B.cyl('trim', 0.385, 0.385, 0.012, 0, 1.42, 0.004, 64, { rx: Math.PI / 2 });
    if (m.tryon) B.hitbox('tryon', 0, 1.15, 0, 0.9, 1.9, 0.35);
    shadowRound(0, 0, 0.6);
    B.pop();
  }

  /* Directory totem by the door: the salon map on the front, a poster on the back */
  {
    const T = L.totem;
    B.push(T.x, T.z, T.ry);
    B.box('bronze', 0.5, 0.03, 0.26, 0, 0.015, 0);
    B.box('bronze', 0.64, 1.86, 0.07, 0, 0.96, 0);
    own(
      new THREE.PlaneGeometry(0.58, 1.16),
      new THREE.MeshBasicMaterial({ map: tex.directory, toneMapped: false }),
      0,
      1.2,
      0.036,
    );
    const back = new THREE.PlaneGeometry(0.58, 0.95);
    back.rotateY(Math.PI);
    own(back, new THREE.MeshBasicMaterial({ map: tex.posters.solstice, toneMapped: false }), 0, 1.2, -0.036);
    B.hitbox('directory', 0, 1.0, 0, 0.7, 2.0, 0.3);
    shadowRect(0, 0, 0.9, 0.5);
    B.pop();
  }

  /* Ribbed ceramic vases with pampas plumes */
  function vase(x, y, z, s, seed) {
    const R = rng(90 + (seed || 0));
    const prof = [
      [0, 0],
      [0.1, 0],
      [0.16, 0.08],
      [0.2, 0.22],
      [0.19, 0.36],
      [0.12, 0.52],
      [0.07, 0.6],
      [0.085, 0.64],
      [0.07, 0.645],
    ].map((q) => new THREE.Vector2(q[0] * s, q[1] * s));
    const g = new THREE.LatheGeometry(prof, 72);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const px = pos.getX(i),
        pz = pos.getZ(i),
        py = pos.getY(i);
      const a = Math.atan2(pz, px);
      const k = 1 + 0.045 * Math.cos(a * 18) * Math.min(1, py / (0.1 * s)) * (py < 0.6 * s ? 1 : 0);
      pos.setX(i, px * k);
      pos.setZ(i, pz * k);
    }
    g.computeVertexNormals();
    g.translate(x, y, z);
    B.geo('ceramic', g);
    const top = new V3(x, y + 0.6 * s, z);
    const n = 9;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + R() * 0.5;
      const tilt = 0.12 + R() * 0.38;
      const dir = new V3(Math.sin(a) * tilt, 1, Math.cos(a) * tilt).normalize();
      const len = (0.85 + R() * 0.55) * s * 1.35;
      const stem = new THREE.CylinderGeometry(0.0035, 0.005, len, 5);
      stem.translate(0, len / 2, 0);
      const q = new THREE.Quaternion().setFromUnitVectors(new V3(0, 1, 0), dir);
      stem.applyQuaternion(q);
      stem.translate(top.x, top.y, top.z);
      B.geo('stem', stem);
      const tip = top.clone().addScaledVector(dir, len);
      for (const rot of [0, Math.PI / 3, (2 * Math.PI) / 3]) {
        const pl = new THREE.PlaneGeometry(0.2 * s * 1.3, 0.52 * s * 1.3);
        pl.translate(0, 0.25 * s * 1.3, 0);
        pl.rotateY(rot + R() * 0.4);
        // plumes droop a little away from the centre
        const droop = new THREE.Quaternion().setFromUnitVectors(
          new V3(0, 1, 0),
          dir
            .clone()
            .add(new V3(0, -0.15, 0))
            .normalize(),
        );
        pl.applyQuaternion(droop);
        const base = tip.clone().addScaledVector(dir, -0.42 * s * 1.3);
        pl.translate(base.x, base.y, base.z);
        B.geo('plume', pl);
      }
    }
    if (y < 0.01) shadowRound(x, z, 0.75 * s);
  }
  L.vases.forEach((v, i) => vase(v[0], 0, v[1], v[2], i));

  return { slots, contacts, mirrors };
}
