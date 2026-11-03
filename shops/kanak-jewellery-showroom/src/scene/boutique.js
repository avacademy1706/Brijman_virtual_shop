// The boutique's architecture and fixtures: the marble rotunda with its dome, chandelier and signature plinth,
// four pillar cases, six salons (wall niches, side cases, a glass counter and stools), the foyer with the rates
// board, concierge desk and glass columns, and the bridal lounge. Returns the display slots for jewellery.
import * as THREE from 'three';
import { NY } from '../core/ny.js';
import { archWall, archCurve } from './batch.js';
import { Kit } from '../jewel/kit.js';

const TAU = Math.PI * 2;
const Ry = (a) => new THREE.Matrix4().makeRotationY(a);
const T = (x, y, z) => new THREE.Matrix4().makeTranslation(x, y, z);

/** ctx: { B (Batcher), coarse }. Returns { slots, chandelier: Kit, hero, cones, lights, reflect, signs } */
export function buildBoutique(ctx) {
  const { B } = ctx;
  const L = NY.L,
    A = L.A,
    WT = L.WT;
  const slots = [];
  const out = { slots, signs: [], lights: [], cones: [], reflect: [], hero: null, chandelier: new Kit(), motes: [] };
  const sideLen = 2 * A * Math.tan(Math.PI / 8);
  const goldTube = (pts, r, closed, key) => {
    const curve = new THREE.CatmullRomCurve3(pts, !!closed, 'centripetal', 0.5);
    B.geo(key || 'gold', new THREE.TubeGeometry(curve, Math.max(16, pts.length * 4), r, 6, !!closed));
  };
  /** A slot for a piece: the current frame times a local placement (+z faces the visitor). */
  const slot = (zone, mode, item, local) => {
    slots.push({ zone, mode, item, frame: B.F.clone().multiply(local || new THREE.Matrix4()) });
  };

  /* ------------------------------------------------------------------ rotunda floor (inlaid marble) */
  {
    const half = L.R + 0.6;
    const pts = [];
    for (let i = 0; i < 8; i++) {
      const a = Math.PI / 8 + (i * Math.PI) / 4;
      pts.push(new THREE.Vector2(L.R * Math.sin(a), L.R * Math.cos(a)));
    }
    const g = new THREE.ShapeGeometry(new THREE.Shape(pts));
    g.rotateX(Math.PI / 2); // shape in x-y -> x-z, facing up after the flip below
    g.scale(1, 1, 1);
    const pos = g.attributes.position,
      uv = g.attributes.uv;
    for (let i = 0; i < pos.count; i++)
      uv.setXY(i, (pos.getX(i) + half) / (2 * half), 1 - (pos.getZ(i) + half) / (2 * half));
    // ShapeGeometry faces +z; rotated by +90deg about x it faces -y. Flip the winding so it faces up.
    const ix = g.index.array;
    for (let i = 0; i < ix.length; i += 3) [ix[i + 1], ix[i + 2]] = [ix[i + 2], ix[i + 1]];
    g.computeVertexNormals();
    B.geo('floorRot', g);
    out.reflect.push(pts.map((p) => [p.x, p.y]));
  }

  /* ------------------------------------------------------------------ rotunda walls, arches, pilasters */
  NY.SIDES.forEach((id, k) => {
    const f = NY.sideFrame(k);
    const o = f.toWorld(0, 0);
    const ow = id === 'foyer' ? L.foyer.opening : id === 'lounge' ? L.lounge.opening : L.opening;
    const sp = L.archSpring;
    B.push(o[0], o[1], f.yaw);
    B.geo('wall', archWall(sideLen + 0.06, L.H, WT, ow, sp, { seg: 28 }));
    // threshold in Nero across the arch
    B.box('nero', ow, 0.012, WT, 0, 0.006, WT / 2);
    // arch moulding and keystone on the rotunda face
    const arch = archCurve(ow, sp, 0.07, 24).map((p) => new THREE.Vector3(p.x, p.y, -0.025));
    goldTube(arch, 0.032);
    const arch2 = archCurve(ow, sp, 0.16, 24).map((p) => new THREE.Vector3(p.x, p.y, -0.018));
    goldTube(arch2, 0.014);
    B.box('gold', 0.2, 0.3, 0.06, 0, sp + ow / 2 + 0.17, -0.03);
    // skirting, dado rail and cornice along the two wall stubs
    const stub = (sideLen - ow) / 2;
    for (const s of [-1, 1]) {
      const cx = s * (ow / 2 + stub / 2);
      B.box('nero', stub + 0.02, 0.2, 0.03, cx, 0.1, -0.015);
      B.box('gold', stub, 0.03, 0.03, cx, 0.98, -0.016);
      // panel frame
      const pw = stub - 0.34,
        y0 = 1.25,
        y1 = 3.95;
      for (const [x0, yy0, x1, yy1] of [
        [cx - pw / 2, y0, cx + pw / 2, y0],
        [cx - pw / 2, y1, cx + pw / 2, y1],
        [cx - pw / 2, y0, cx - pw / 2, y1],
        [cx + pw / 2, y0, cx + pw / 2, y1],
      ]) {
        const len = Math.hypot(x1 - x0, yy1 - yy0) + 0.02;
        B.box('gold', x0 === x1 ? 0.018 : len, x0 === x1 ? len : 0.018, 0.016, (x0 + x1) / 2, (yy0 + yy1) / 2, -0.01);
      }
      // sconce with a candle bulb
      B.box('gold', 0.12, 0.26, 0.02, cx, 2.7, -0.012);
      B.cyl('gold', 0.012, 0.012, 0.16, cx, 2.66, -0.09, 6, { rx: Math.PI / 2 });
      B.cyl('gold', 0.045, 0.03, 0.05, cx, 2.68, -0.17, 12);
      B.sph('bulb', 0.03, cx, 2.75, -0.17, 1, 1.5, 1, 10);
      B.plane('poolWall', 0.9, 1.3, cx, 2.75, -0.008, 0, 0);
    }
    B.box('wallTrim', sideLen + 0.06, 0.24, 0.12, 0, L.H - 0.12, -0.06);
    B.box('gold', sideLen + 0.06, 0.025, 0.02, 0, L.H - 0.27, -0.12);
    // the section's name above the arch
    if (id !== 'foyer') {
      const z = NY.zoneById(id);
      out.signs.push({
        text: z.name.toUpperCase(),
        w: 2.9,
        h: 0.3,
        m: B.F.clone()
          .multiply(T(0, sp + ow / 2 + 0.52, -0.02))
          .multiply(Ry(Math.PI)),
      });
    } else {
      out.signs.push({
        text: 'KANAK',
        w: 2.2,
        h: 0.42,
        size: 0.75,
        track: 0.5,
        m: B.F.clone().multiply(T(0, sp + ow / 2 + 0.38, WT + 0.02)),
      });
    }
    B.pop();
    // pilaster at the corner between side k and k + 1
    const a = Math.PI / 8 + (k * Math.PI) / 4;
    const px = L.R * Math.sin(a),
      pz = L.R * Math.cos(a);
    B.push(px, pz, a);
    B.box('wallTrim', 0.5, L.H - 0.3, 0.36, 0, (L.H - 0.3) / 2, 0.02);
    B.box('nero', 0.56, 0.26, 0.4, 0, 0.13, 0.02);
    B.box('gold', 0.58, 0.05, 0.42, 0, 0.29, 0.02);
    B.box('gold', 0.6, 0.16, 0.44, 0, L.H - 0.36, 0.02);
    for (let i = -2; i <= 2; i++) B.box('wallFlute', 0.04, L.H - 0.9, 0.02, i * 0.085, (L.H - 0.3) / 2 + 0.1, -0.165);
    B.pop();
  });

  /* ------------------------------------------------------------------ dome, oculus, ribs */
  {
    const rD = A + 0.05;
    const g = new THREE.SphereGeometry(rD, ctx.coarse ? 40 : 64, ctx.coarse ? 12 : 20, 0, TAU, 0, Math.PI / 2);
    g.scale(1, L.domeH / rD, 1);
    g.translate(0, L.H, 0);
    B.geo('dome', g);
    // flat ring from the octagon to the dome's circle
    const sh = new THREE.Shape();
    for (let i = 0; i <= 8; i++) {
      const a = Math.PI / 8 + (i * Math.PI) / 4;
      const x = (L.R + 0.3) * Math.sin(a),
        y = (L.R + 0.3) * Math.cos(a);
      if (i) sh.lineTo(x, y);
      else sh.moveTo(x, y);
    }
    const hole = new THREE.Path();
    hole.absarc(0, 0, rD - 0.02, 0, TAU, true);
    sh.holes.push(hole);
    const ring = new THREE.ShapeGeometry(sh, 48);
    ring.rotateX(Math.PI / 2);
    ring.translate(0, L.H, 0);
    B.geo('ceil', ring);
    const ring2 = new THREE.TorusGeometry(rD - 0.04, 0.06, 8, 96);
    ring2.rotateX(Math.PI / 2);
    ring2.translate(0, L.H + 0.02, 0);
    B.geo('gold', ring2);
    // sixteen ribs from the rim to the oculus
    const oR = 1.05;
    const topY = (r) => L.H + L.domeH * Math.sqrt(Math.max(0, 1 - (r / rD) ** 2));
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU;
      const pts = [];
      for (let j = 0; j <= 12; j++) {
        const r = rD - 0.06 - ((rD - 0.06 - oR) * j) / 12;
        pts.push(new THREE.Vector3(Math.sin(a) * r * 0.99, topY(r) - 0.03, Math.cos(a) * r * 0.99));
      }
      goldTube(pts, i % 2 ? 0.022 : 0.04);
    }
    const oy = topY(oR) - 0.02;
    B.torus('gold', oR, 0.07, 0, oy, 0, Math.PI / 2, 64);
    B.torus('gold', oR - 0.16, 0.03, 0, oy + 0.03, 0, Math.PI / 2, 48);
    // the lantern: warm light through the oculus
    B.cyl('sky', oR - 0.05, oR - 0.05, 0.02, 0, oy + 0.12, 0, 48);
    out.oculusY = oy;
  }

  /* ------------------------------------------------------------------ chandelier */
  {
    const ck = out.chandelier;
    const top = out.oculusY,
      y0 = 6.2;
    B.cyl('gold', 0.018, 0.018, top - y0 + 0.2, 0, (top + y0) / 2, 0, 8);
    const tiers = [
      { y: 6.15, r: 1.25, drops: ctx.coarse ? 36 : 54, arms: 12 },
      { y: 5.7, r: 0.88, drops: ctx.coarse ? 26 : 40, arms: 8 },
      { y: 5.3, r: 0.5, drops: ctx.coarse ? 16 : 24, arms: 6 },
    ];
    B.sph('gold', 0.1, 0, 6.25, 0, 1, 1.4, 1, 20);
    B.cyl('gold', 0.04, 0.02, 1.1, 0, 5.65, 0, 12);
    for (const t of tiers) {
      B.torus('gold', t.r, 0.022, 0, t.y, 0, Math.PI / 2, 64);
      for (let i = 0; i < t.arms; i++) {
        const a = (i / t.arms) * TAU;
        goldTube(
          [
            new THREE.Vector3(0, t.y + 0.25, 0),
            new THREE.Vector3(Math.sin(a) * t.r * 0.45, t.y - 0.05, Math.cos(a) * t.r * 0.45),
            new THREE.Vector3(Math.sin(a) * t.r, t.y, Math.cos(a) * t.r),
          ],
          0.012,
        );
        // candle cup and bulb
        const x = Math.sin(a) * t.r,
          z = Math.cos(a) * t.r;
        B.cyl('gold', 0.035, 0.02, 0.05, x, t.y + 0.04, z, 10);
        B.cyl('candle', 0.012, 0.012, 0.09, x, t.y + 0.11, z, 8);
        B.sph('bulb', 0.024, x, t.y + 0.18, z, 1, 1.6, 1, 10);
      }
      // hanging crystals: a bead and a drop on each strand
      for (let i = 0; i < t.drops; i++) {
        const a = (i / t.drops) * TAU + 0.05;
        const x = Math.sin(a) * t.r,
          z = Math.cos(a) * t.r;
        ck.gem('crystal', 'round', 0.022, [x, t.y - 0.04, z], [Math.sin(a), 0, Math.cos(a)]);
        ck.gem('crystal', 'briolette', 0.034, [x, t.y - 0.1, z], [0, 1, 0], [Math.cos(a), 0, -Math.sin(a)]);
      }
    }
    // crystal swags between the tiers
    const sw = ctx.coarse ? 8 : 14;
    for (let i = 0; i < sw; i++) {
      const a0 = (i / sw) * TAU,
        a1 = ((i + 1) / sw) * TAU;
      const p0 = new THREE.Vector3(Math.sin(a0) * 1.25, 6.15, Math.cos(a0) * 1.25),
        p1 = new THREE.Vector3(Math.sin(a1) * 1.25, 6.15, Math.cos(a1) * 1.25);
      for (let j = 1; j < 8; j++) {
        const t = j / 8;
        const p = p0.clone().lerp(p1, t);
        p.y -= Math.sin(t * Math.PI) * 0.16;
        p.multiplyScalar(1).setY(p.y);
        ck.gem('crystal', 'round', 0.018, [p.x, p.y, p.z], [p.x, 0, p.z]);
      }
    }
    ck.gem('crystal', 'briolette', 0.09, [0, 4.98, 0], [0, 1, 0]);
    ck.gem('crystal', 'round', 0.05, [0, 5.08, 0], [0, 1, 0]);
    out.lights.push({ kind: 'chandelier', pos: [0, 5.6, 0] });
  }

  /* ------------------------------------------------------------------ hero plinth (signature piece) */
  {
    B.cyl('nero', 0.85, 0.88, 0.14, 0, 0.07, 0, 64);
    B.torus('gold', 0.86, 0.018, 0, 0.14, 0, Math.PI / 2, 96);
    B.cyl('lacquer', 0.66, 0.7, 0.82, 0, 0.55, 0, 64);
    B.torus('gold', 0.67, 0.022, 0, 0.92, 0, Math.PI / 2, 96);
    B.torus('gold', 0.69, 0.015, 0, 0.2, 0, Math.PI / 2, 96);
    B.cyl('nero', 0.62, 0.62, 0.05, 0, 0.985, 0, 64);
    // bell jar
    B.cyl('glass', 0.42, 0.42, 0.62, 0, 1.33, 0, 48, { open: true });
    const cap = new THREE.SphereGeometry(0.42, 48, 12, 0, TAU, 0, Math.PI / 2);
    cap.scale(1, 0.45, 1);
    cap.translate(0, 1.64, 0);
    B.geo('glass', cap);
    B.torus('gold', 0.425, 0.012, 0, 1.02, 0, Math.PI / 2, 64);
    B.sph('gold', 0.025, 0, 1.84, 0, 1, 1, 1, 12);
    out.hero = { y: 1.01, item: NY.MERCH.hero };
    out.cones.push({ top: [0, out.oculusY, 0], bottom: [0, 1.0, 0], r0: 0.55, r1: 0.95 });
    out.motes.push({ c: [0, 2.8, 0], r: 0.7, h: 3.4 });
  }

  /* ------------------------------------------------------------------ pillar cases */
  L.pillarAngles.forEach((deg, i) => {
    const a = (deg * Math.PI) / 180;
    const x = L.pillarR * Math.sin(a),
      z = L.pillarR * Math.cos(a);
    B.push(x, z, a + Math.PI); // +z of the frame points to the centre
    B.box('nero', 0.56, 1.0, 0.56, 0, 0.5, 0);
    B.box('gold', 0.6, 0.035, 0.6, 0, 1.0, 0);
    B.box('gold', 0.6, 0.035, 0.6, 0, 0.04, 0);
    // glass cube
    for (const [w, h, d, px, py, pz] of [
      [0.46, 0.46, 0.005, 0, 1.25, 0.23],
      [0.46, 0.46, 0.005, 0, 1.25, -0.23],
      [0.005, 0.46, 0.46, 0.23, 1.25, 0],
      [0.005, 0.46, 0.46, -0.23, 1.25, 0],
      [0.46, 0.005, 0.46, 0, 1.48, 0],
    ])
      B.box('glass', w, h, d, px, py, pz, { uv: false });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) B.box('gold', 0.012, 0.47, 0.012, sx * 0.23, 1.25, sz * 0.23);
    B.box('velvet_rotunda', 0.44, 0.02, 0.44, 0, 1.03, 0);
    B.plane('pool', 0.5, 0.5, 0, 1.042, 0, -Math.PI / 2);
    slot('rotunda', 'pillar', NY.MERCH.pillars[i], T(0, 1.04, 0.02));
    B.plane('shRect', 0.9, 0.9, 0, 0.004, 0, -Math.PI / 2);
    B.pop();
  });

  /* ------------------------------------------------------------------ salons */
  const F = NY.SALON_FIX;
  for (const id of ['everyday', 'temple', 'polki', 'solitaire', 'diamond', 'gems']) {
    const k = NY.sideOf(id);
    const f = NY.sideFrame(k);
    const o = f.toWorld(0, 0);
    const W = L.salon.W,
      D = L.salon.D,
      H = L.salonH;
    const v0 = WT,
      v1 = WT + D;
    const wallK = 'wall_' + id,
      velK = 'velvet_' + id,
      carpetK = 'carpet_' + id;
    const merch = NY.MERCH.salons[id];
    B.push(o[0], o[1], f.yaw);
    // floor, ceiling, cove light
    B.plane(carpetK, W, D, 0, 0.002, (v0 + v1) / 2, -Math.PI / 2, 0, 1.2);
    B.plane('ceil', W, D, 0, H, (v0 + v1) / 2, Math.PI / 2);
    for (const [w, d, x, z] of [
      [W - 0.4, 0.03, 0, v0 + 0.2],
      [W - 0.4, 0.03, 0, v1 - 0.2],
      [0.03, D - 0.4, -W / 2 + 0.2, (v0 + v1) / 2],
      [0.03, D - 0.4, W / 2 - 0.2, (v0 + v1) / 2],
    ])
      B.box('glowSoft', w, 0.02, d, x, H - 0.05, z);
    B.box(wallK, W, 0.22, 0.24, 0, H - 0.11, v0 + 0.12);
    // side walls
    B.box(wallK, 0.15, H, D + 0.3, -W / 2 - 0.075, H / 2, (v0 + v1) / 2);
    B.box(wallK, 0.15, H, D + 0.3, W / 2 + 0.075, H / 2, (v0 + v1) / 2);
    // back wall with three arched niches
    {
      const s = new THREE.Shape();
      s.moveTo(-W / 2, 0);
      s.lineTo(W / 2, 0);
      s.lineTo(W / 2, H);
      s.lineTo(-W / 2, H);
      s.lineTo(-W / 2, 0);
      // niches sized for a life-size bust on a small riser, so the jewellery reads well from the counter
      const nw = F.nicheW,
        sill = 0.98,
        spr = 1.62,
        riser = 0.1;
      for (const u of F.niches) {
        const h = new THREE.Path();
        h.moveTo(u - nw / 2, sill);
        h.lineTo(u + nw / 2, sill);
        h.lineTo(u + nw / 2, spr);
        h.absarc(u, spr, nw / 2, 0, Math.PI, false);
        h.lineTo(u - nw / 2, sill);
        s.holes.push(h);
      }
      const g = new THREE.ExtrudeGeometry(s, { depth: 0.12, bevelEnabled: false, curveSegments: 20 });
      g.translate(0, 0, v1);
      B.geo(wallK, g);
      const nd = 0.42;
      F.niches.forEach((u, i) => {
        const zb = v1 + 0.12 + nd;
        // velvet back, sides, sill and vault
        B.plane(velK, nw, spr + nw / 2 - sill + 0.05, u, (sill + spr + nw / 2) / 2, zb, 0, Math.PI);
        B.plane(
          velK,
          nd + 0.12,
          spr + nw / 2 - sill,
          u - nw / 2,
          (sill + spr + nw / 2) / 2,
          v1 + (0.12 + nd) / 2,
          0,
          Math.PI / 2,
        );
        B.plane(
          velK,
          nd + 0.12,
          spr + nw / 2 - sill,
          u + nw / 2,
          (sill + spr + nw / 2) / 2,
          v1 + (0.12 + nd) / 2,
          0,
          -Math.PI / 2,
        );
        B.plane(velK, nw, nd + 0.12, u, sill, v1 + (0.12 + nd) / 2, -Math.PI / 2);
        const vault = new THREE.CylinderGeometry(nw / 2, nw / 2, nd + 0.12, 20, 1, true, Math.PI / 2, Math.PI);
        vault.rotateX(Math.PI / 2);
        // flip so the inside faces down
        const ix = vault.index.array;
        for (let q = 0; q < ix.length; q += 3) [ix[q + 1], ix[q + 2]] = [ix[q + 2], ix[q + 1]];
        vault.computeVertexNormals();
        vault.translate(u, spr, v1 + (0.12 + nd) / 2);
        B.geo(velK, vault);
        // glass and a gold arch trim on the room side
        const gs = new THREE.Shape();
        gs.moveTo(u - nw / 2, sill);
        gs.lineTo(u + nw / 2, sill);
        gs.lineTo(u + nw / 2, spr);
        gs.absarc(u, spr, nw / 2, 0, Math.PI, false);
        const gg = new THREE.ShapeGeometry(gs, 16);
        gg.translate(0, 0, v1 + 0.03);
        B.geo('glass', gg);
        const tr = archCurve(nw, spr - sill, 0.05, 16).map((p) => new THREE.Vector3(u + p.x, sill + p.y, v1 - 0.012));
        goldTube(tr, 0.018);
        B.box('gold', nw + 0.16, 0.03, 0.05, u, sill - 0.015, v1 - 0.01);
        // light from above and a glow on the velvet
        B.box('glow', nw * 0.7, 0.012, 0.02, u, spr + nw * 0.32, v1 + 0.2);
        B.plane('pool', nw * 1.1, 1.0, u, sill + 0.5, zb - 0.01, 0, Math.PI);
        // velvet riser with a thin gold edge
        B.box(velK, 0.34, riser, 0.26, u, sill + riser / 2, v1 + 0.12 + nd * 0.45);
        B.box('gold', 0.345, 0.008, 0.265, u, sill + riser - 0.004, v1 + 0.12 + nd * 0.45);
        slot(id, 'niche', merch.niches[i], T(u, sill + riser, v1 + 0.12 + nd * 0.45).multiply(Ry(Math.PI)));
      });
      // skirting and dado on the back wall
      B.box('nero', W, 0.18, 0.03, 0, 0.09, v1 - 0.015);
    }
    // side cases (left and right walls)
    for (const sd of [-1, 1]) {
      const c = F.sideCase;
      const cu = (sd * (c.u0 + c.u1)) / 2,
        cw = c.u1 - c.u0,
        cv = (c.v0 + c.v1) / 2,
        cl = c.v1 - c.v0;
      B.box('lacquer', cw, c.h, cl, cu, c.h / 2, cv);
      B.box('gold', 0.01, 0.05, cl, sd * c.u0 - sd * 0.002, 0.08, cv);
      B.box('gold', 0.012, 0.025, cl, sd * c.u0 - sd * 0.003, c.h - 0.012, cv);
      B.box(velK, cw - 0.02, 0.012, cl - 0.02, cu, c.h + 0.006, cv);
      B.plane(velK, cl - 0.02, c.top - c.h, sd * (c.u1 - 0.01), (c.h + c.top) / 2, cv, 0, (-sd * Math.PI) / 2);
      // glass box with thin gold edges
      const gh = c.top - c.h;
      B.box('glass', 0.006, gh, cl, sd * c.u0, c.h + gh / 2, cv, { uv: false });
      B.box('glass', cw, 0.006, cl, cu, c.top, cv, { uv: false });
      for (const e of [c.v0, c.v1]) B.box('glass', cw, gh, 0.006, cu, c.h + gh / 2, e, { uv: false });
      for (const e of [c.v0, c.v1]) B.box('gold', 0.014, gh, 0.014, sd * c.u0, c.h + gh / 2, e);
      B.box('gold', 0.014, 0.014, cl, sd * c.u0, c.top, cv);
      B.box('glow', 0.02, 0.01, cl - 0.1, sd * (c.u0 + 0.06), c.top - 0.02, cv);
      B.plane('pool', cw * 1.4, cl, cu, c.h + 0.013, cv, -Math.PI / 2);
      B.plane('shRect', cw + 0.4, cl + 0.3, cu - sd * 0.1, 0.004, cv, -Math.PI / 2);
      const list = sd < 0 ? merch.left : merch.right;
      list.forEach((item, i) => {
        const v = c.v0 + ((i + 0.5) / list.length) * cl;
        slot(id, 'case', item, T(cu + sd * 0.04, c.h + 0.012, v).multiply(Ry(sd < 0 ? Math.PI / 2 : -Math.PI / 2)));
      });
    }
    // counter
    {
      const c = F.counter;
      const cv = (c.v0 + c.v1) / 2,
        cd = c.v1 - c.v0,
        base = 0.72;
      B.box('lacquer', c.u * 2, base, cd, 0, base / 2, cv);
      B.box('gold', c.u * 2 + 0.01, 0.03, cd + 0.01, 0, base - 0.015, cv);
      B.box('gold', c.u * 2 + 0.01, 0.05, 0.01, 0, 0.07, c.v0 - 0.003);
      B.box(velK, c.u * 2 - 0.04, 0.012, cd - 0.04, 0, base + 0.006, cv);
      const gh = c.h - base;
      B.box('glass', c.u * 2, 0.008, cd, 0, c.h, cv, { uv: false });
      B.box('glass', c.u * 2, gh, 0.006, 0, base + gh / 2, c.v0, { uv: false });
      B.box('glass', c.u * 2, gh, 0.006, 0, base + gh / 2, c.v1, { uv: false });
      for (const s of [-1, 1]) B.box('glass', 0.006, gh, cd, s * c.u, base + gh / 2, cv, { uv: false });
      for (const s of [-1, 1]) for (const e of [c.v0, c.v1]) B.box('gold', 0.012, gh, 0.012, s * c.u, base + gh / 2, e);
      B.box('gold', c.u * 2, 0.012, 0.012, 0, c.h, c.v0);
      B.plane('pool', c.u * 2, cd, 0, base + 0.013, cv, -Math.PI / 2);
      B.plane('shRect', c.u * 2 + 0.5, cd + 0.4, 0, 0.004, cv, -Math.PI / 2);
      B.plane('poolFloor', 2.4, 1.6, 0, 0.004, c.v0 - 0.7, -Math.PI / 2);
      merch.counter.forEach((item, i) => {
        const u = -c.u + 0.16 + ((i + 0.5) / merch.counter.length) * (c.u * 2 - 0.32);
        slot(id, 'counter', item, T(u, base + 0.012, cv).multiply(Ry(Math.PI)));
      });
      B.hitbox('browse:' + id, 0, base / 2, cv, c.u * 2, base, cd);
    }
    // stools
    for (const [u, v] of F.stools) {
      B.cyl(velK, 0.2, 0.19, 0.09, u, 0.66, v, 24);
      B.torus('gold', 0.195, 0.01, u, 0.62, v, Math.PI / 2, 32);
      B.cyl('gold', 0.022, 0.022, 0.6, u, 0.32, v, 10);
      B.cyl('gold', 0.17, 0.19, 0.02, u, 0.01, v, 24);
      B.plane('shRound', 0.6, 0.6, u, 0.004, v, -Math.PI / 2);
    }
    // pendant light
    B.torus('gold', 0.5, 0.02, 0, H - 0.75, (v0 + v1) / 2 + 0.3, Math.PI / 2, 48);
    B.torus('glow', 0.5, 0.008, 0, H - 0.77, (v0 + v1) / 2 + 0.3, Math.PI / 2, 48);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + Math.PI / 4;
      B.cyl('gold', 0.004, 0.004, 0.75, Math.sin(a) * 0.5, H - 0.375, (v0 + v1) / 2 + 0.3 + Math.cos(a) * 0.5, 4);
    }
    out.lights.push({ kind: 'salon', zone: id, pos: f.toWorld(0, (v0 + v1) / 2 + 0.3).concat([H - 0.9]) });
    B.pop();
  }

  /* ------------------------------------------------------------------ foyer */
  {
    const k = 0,
      f = NY.sideFrame(k);
    const o = f.toWorld(0, 0);
    const W = L.foyer.W,
      D = L.foyer.D,
      H = L.foyer.H;
    const v0 = WT,
      v1 = WT + D;
    B.push(o[0], o[1], f.yaw);
    B.plane('foyerFloor', W, D, 0, 0.001, (v0 + v1) / 2, -Math.PI / 2, 0, 1.2);
    out.reflect.push([
      f.toWorld(-W / 2, v0 - 0.4),
      f.toWorld(W / 2, v0 - 0.4),
      f.toWorld(W / 2, v1),
      f.toWorld(-W / 2, v1),
    ]);
    B.plane('ceil', W, D, 0, H, (v0 + v1) / 2, Math.PI / 2);
    // coffers
    for (let i = -1; i <= 1; i++) B.box('gold', 0.02, 0.06, D - 0.2, i * 1.5, H - 0.03, (v0 + v1) / 2);
    for (let j = 1; j < 3; j++) B.box('gold', W - 0.2, 0.06, 0.02, 0, H - 0.03, v0 + (j * D) / 3);
    B.box('wall', 0.15, H, D + 0.3, -W / 2 - 0.075, H / 2, (v0 + v1) / 2);
    B.box('wall', 0.15, H, D + 0.3, W / 2 + 0.075, H / 2, (v0 + v1) / 2);
    for (const s of [-1, 1]) {
      B.box('nero', 0.03, 0.2, D, s * (W / 2 - 0.015), 0.1, (v0 + v1) / 2);
      B.box('gold', 0.03, 0.03, D, s * (W / 2 - 0.016), 0.98, (v0 + v1) / 2);
      B.box('wallTrim', 0.12, 0.24, D, s * (W / 2 - 0.06), H - 0.12, (v0 + v1) / 2);
    }
    // front wall with the entrance arch and glass doors
    const dw = L.foyer.door,
      dsp = 2.65;
    const fw = archWall(W + 0.3, H, 0.25, dw, dsp, { seg: 28 });
    fw.translate(0, 0, v1);
    B.geo('wall', fw);
    const dc = archCurve(dw, dsp, 0.06, 24).map((p) => new THREE.Vector3(p.x, p.y, v1 - 0.02));
    goldTube(dc, 0.035);
    for (const s of [-1, 1]) {
      // door leaves: gold frame and glass
      const x = (s * dw) / 4;
      B.box('glass', dw / 2 - 0.08, dsp - 0.06, 0.012, x, (dsp - 0.06) / 2, v1 + 0.12, { uv: false });
      B.box('gold', 0.04, dsp, 0.05, s * (dw / 2 - 0.02), dsp / 2, v1 + 0.12);
      B.box('gold', 0.04, dsp, 0.05, s * 0.02, dsp / 2, v1 + 0.12);
      B.box('gold', dw / 2, 0.05, 0.05, x, dsp, v1 + 0.12);
      B.box('gold', dw / 2, 0.08, 0.05, x, 0.04, v1 + 0.12);
      B.cyl('gold', 0.012, 0.012, 0.5, s * 0.09, 1.1, v1 + 0.08, 8);
    }
    // transom glass with radial bars
    {
      const gs = new THREE.Shape();
      gs.moveTo(-dw / 2, dsp);
      gs.absarc(0, dsp, dw / 2, Math.PI, 0, true);
      gs.lineTo(-dw / 2, dsp);
      const gg = new THREE.ShapeGeometry(gs, 24);
      gg.translate(0, 0, v1 + 0.12);
      B.geo('glass', gg);
      for (let i = 1; i < 6; i++) {
        const a = Math.PI - (i / 6) * Math.PI;
        goldTube(
          [
            new THREE.Vector3(0, dsp, v1 + 0.1),
            new THREE.Vector3(Math.cos(a) * dw * 0.5, dsp + Math.sin(a) * dw * 0.5, v1 + 0.1),
          ],
          0.01,
        );
      }
    }
    // outside: pavement and an evening street
    B.plane('pavement', 24, 14, 0, -0.02, v1 + 7, -Math.PI / 2);
    B.plane('dusk', 34, 12, 0, 4.5, v1 + 10, 0, Math.PI);
    // rates board on the left wall
    B.box('gold', 0.05, 1.42, 1.08, -W / 2 + 0.03, 1.86, 2.9);
    B.plane('board', 0.98, 1.3, -W / 2 + 0.062, 1.86, 2.9, 0, Math.PI / 2);
    B.hitbox('rates', -W / 2 + 0.1, 1.86, 2.9, 0.2, 1.4, 1.1);
    B.plane('poolWall', 1.6, 1.9, -W / 2 + 0.058, 1.86, 2.9, 0, Math.PI / 2);
    // concierge desk on the right
    B.box('lacquer', 0.62, 1.0, 1.5, 2.6, 0.5, 2.95);
    B.box('nero', 0.7, 0.04, 1.58, 2.58, 1.02, 2.95);
    B.box('gold', 0.012, 0.05, 1.5, 2.288, 0.08, 2.95);
    B.box('gold', 0.012, 0.02, 1.5, 2.288, 0.98, 2.95);
    B.cyl('gold', 0.06, 0.08, 0.03, 2.6, 1.055, 3.45, 16);
    B.cyl('gold', 0.008, 0.008, 0.36, 2.6, 1.23, 3.45, 6);
    B.cyl('lampShade', 0.09, 0.13, 0.14, 2.6, 1.45, 3.45, 20, { open: true });
    B.sph('bulb', 0.03, 2.6, 1.4, 3.45, 1, 1, 1, 8);
    // orchid in a gold pot
    B.cyl('gold', 0.07, 0.055, 0.12, 2.62, 1.1, 2.45, 16);
    for (let i = 0; i < 7; i++) {
      const t = i / 6;
      B.sph('petal', 0.028, 2.62 + Math.sin(t * 2.4) * 0.12, 1.32 + t * 0.18, 2.45 - t * 0.08, 1.2, 0.6, 1.2, 10);
    }
    B.cyl('stem', 0.004, 0.004, 0.32, 2.62, 1.3, 2.45, 4);
    B.hitbox('appointment', 2.6, 0.6, 2.95, 0.7, 1.2, 1.6);
    B.plane('shRect', 1.1, 1.9, 2.6, 0.004, 2.95, -Math.PI / 2);
    // glass columns at the arch into the rotunda
    for (const s of [-1, 1]) {
      const x = s * 2.25,
        z = 1.15;
      B.cyl('nero', 0.34, 0.36, 0.84, x, 0.42, z, 32);
      B.torus('gold', 0.35, 0.014, x, 0.84, z, Math.PI / 2, 40);
      B.cyl('glass', 0.27, 0.27, 0.92, x, 1.3, z, 40, { open: true });
      B.cyl('glass', 0.27, 0.27, 0.006, x, 1.76, z, 40);
      B.torus('gold', 0.275, 0.012, x, 1.765, z, Math.PI / 2, 40);
      B.cyl('velvet_rotunda', 0.24, 0.24, 0.02, x, 0.85, z, 32);
      B.plane('pool', 0.5, 0.5, x, 0.862, z, -Math.PI / 2);
      B.plane('shRound', 1.0, 1.0, x, 0.004, z, -Math.PI / 2);
      slot('foyer', 'column', NY.MERCH.columns[s < 0 ? 0 : 1], T(x, 0.86, z));
    }
    // runner rug
    B.plane('rug', 1.8, 2.8, 0, 0.006, 2.6, -Math.PI / 2);
    // small chandelier
    B.torus('gold', 0.42, 0.016, 0, H - 0.9, (v0 + v1) / 2, Math.PI / 2, 40);
    B.cyl('gold', 0.01, 0.01, 0.9, 0, H - 0.45, (v0 + v1) / 2, 6);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      const p = f.toWorld(Math.sin(a) * 0.42, (v0 + v1) / 2 + Math.cos(a) * 0.42);
      B.sph('bulb', 0.022, Math.sin(a) * 0.42, H - 0.84, (v0 + v1) / 2 + Math.cos(a) * 0.42, 1, 1.5, 1, 8);
      out.chandelier.gem('crystal', 'briolette', 0.03, [p[0], H - 0.98, p[1]], [0, 1, 0]);
    }
    out.lights.push({ kind: 'foyer', pos: f.toWorld(0, (v0 + v1) / 2).concat([H - 1.0]) });
    B.pop();
  }

  /* ------------------------------------------------------------------ bridal lounge */
  {
    const k = 4,
      f = NY.sideFrame(k);
    const o = f.toWorld(0, 0);
    const W = L.lounge.W,
      D = L.lounge.D,
      H = L.lounge.H;
    const v0 = WT,
      v1 = WT + D;
    B.push(o[0], o[1], f.yaw);
    B.plane('carpet_lounge', W, D, 0, 0.002, (v0 + v1) / 2, -Math.PI / 2, 0, 1.4);
    B.plane('ceil', W, D, 0, H, (v0 + v1) / 2, Math.PI / 2);
    for (const [w, d, x, z] of [
      [W - 0.4, 0.03, 0, v0 + 0.2],
      [W - 0.4, 0.03, 0, v1 - 0.2],
      [0.03, D - 0.4, -W / 2 + 0.2, (v0 + v1) / 2],
      [0.03, D - 0.4, W / 2 - 0.2, (v0 + v1) / 2],
    ])
      B.box('glowSoft', w, 0.02, d, x, H - 0.05, z);
    B.box('wall_lounge', 0.15, H, D + 0.3, -W / 2 - 0.075, H / 2, (v0 + v1) / 2);
    B.box('wall_lounge', 0.15, H, D + 0.3, W / 2 + 0.075, H / 2, (v0 + v1) / 2);
    B.box('wall_lounge', W + 0.3, H, 0.15, 0, H / 2, v1 + 0.075);
    for (const [x, z, w, d] of [
      [-W / 2 + 0.015, (v0 + v1) / 2, 0.03, D],
      [W / 2 - 0.015, (v0 + v1) / 2, 0.03, D],
      [0, v1 - 0.015, W, 0.03],
    ]) {
      B.box('gold', w, 0.025, d, x, 0.95, z);
      B.box('nero', w, 0.18, d, x, 0.09, z);
    }
    // drapes either side of the arch, tied back with gold
    for (const s of [-1, 1]) {
      const g = new THREE.PlaneGeometry(0.75, 3.7, 18, 12);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i),
          y = p.getY(i);
        const gather = 1 - 0.55 * Math.exp(-(((y + 0.6) / 0.6) ** 2)); // pinched at the tie-back
        p.setX(i, x * gather);
        p.setZ(i, 0.06 * Math.sin(((x + 0.375) / 0.75) * Math.PI * 7) * gather);
      }
      g.computeVertexNormals();
      g.translate(s * (L.lounge.opening / 2 + 0.36), 1.85, v0 + 0.08);
      B.geo('drape', g);
      const g2 = g.clone().rotateY(Math.PI);
      g2.translate(2 * s * (L.lounge.opening / 2 + 0.36), 0, 2 * (v0 + 0.08));
      B.geo('drape', g2);
      B.torus('gold', 0.09, 0.012, s * (L.lounge.opening / 2 + 0.36), 1.25, v0 + 0.1, 0, 20);
    }
    B.box('gold', L.lounge.opening + 1.6, 0.05, 0.05, 0, 3.75, v0 + 0.06);
    // sofa against the back wall
    {
      const z = 5.0;
      B.box('sofa', 3.0, 0.42, 0.82, 0, 0.27, z);
      B.box('sofa', 3.0, 0.62, 0.2, 0, 0.73, z + 0.33);
      for (const s of [-1, 1]) B.box('sofa', 0.2, 0.62, 0.82, s * 1.5, 0.37, z);
      for (const s of [-1, 0, 1]) B.box('sofaCushion', 0.92, 0.12, 0.7, s * 0.95, 0.53, z - 0.03);
      for (let i = 0; i < 9; i++)
        for (let j = 0; j < 2; j++) B.sph('gold', 0.012, -1.3 + i * 0.325, 0.68 + j * 0.2, z + 0.225, 1, 1, 0.6, 6);
      for (const s of [-1, 1])
        for (const e of [-1, 1]) B.cyl('gold', 0.02, 0.015, 0.06, s * 1.45, 0.03, z + e * 0.35, 8);
      B.plane('shRect', 3.5, 1.2, 0, 0.004, z, -Math.PI / 2);
      // arched gilt mirror above the sofa
      const mw = 1.5,
        msp = 1.7;
      const ms = new THREE.Shape();
      ms.moveTo(-mw / 2, 1.3);
      ms.lineTo(mw / 2, 1.3);
      ms.lineTo(mw / 2, msp + 1.3 - 0.75);
      ms.absarc(0, msp + 1.3 - 0.75, mw / 2, 0, Math.PI, false);
      const mg = new THREE.ShapeGeometry(ms, 24);
      mg.rotateY(Math.PI);
      mg.translate(0, 0, v1 - 0.01);
      B.geo('mirrorDecor', mg);
      const mt = archCurve(mw, msp - 0.75, 0.05, 20).map((p) => new THREE.Vector3(-p.x, 1.3 + p.y, v1 - 0.02));
      goldTube(mt, 0.035);
    }
    // coffee table with trays
    {
      const z = 3.6;
      const top = new THREE.CylinderGeometry(1, 1, 0.045, 48);
      top.scale(0.85, 1, 0.38);
      top.translate(0, 0.44, z);
      B.geo('statuarioTop', top);
      const ring = new THREE.TorusGeometry(1, 0.012, 6, 64);
      ring.rotateX(Math.PI / 2);
      ring.scale(0.86, 1, 0.39);
      ring.translate(0, 0.44, z);
      B.geo('gold', ring);
      for (const s of [-1, 1]) {
        B.cyl('gold', 0.02, 0.02, 0.42, s * 0.55, 0.21, z, 8);
        B.cyl('gold', 0.12, 0.12, 0.012, s * 0.55, 0.006, z, 20);
      }
      B.box('velvet_lounge', 0.62, 0.018, 0.34, -0.28, 0.471, z);
      B.box('velvet_lounge', 0.62, 0.018, 0.34, 0.32, 0.471, z);
      const tbl = NY.MERCH.lounge.table;
      tbl.forEach((item, i) => {
        const u = -0.52 + (i / (tbl.length - 1)) * 1.04;
        slot('lounge', 'counter', item, T(u, 0.48, z).multiply(Ry(Math.PI)));
      });
      // roses in a gold bowl
      B.cyl('gold', 0.09, 0.05, 0.08, 0.62, 0.5, z, 20);
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * TAU;
        B.sph('rose', 0.035, 0.62 + Math.cos(a) * 0.05, 0.57 + (i % 3) * 0.01, z + Math.sin(a) * 0.05, 1, 0.8, 1, 10);
      }
      B.plane('shRect', 2.0, 1.0, 0, 0.004, z, -Math.PI / 2);
      B.hitbox('sets', 0, 0.3, z, 1.7, 0.6, 0.8);
    }
    // armchairs either side of the table
    for (const s of [-1, 1]) {
      B.push(s * 1.75, 3.6, s < 0 ? Math.PI / 2 : -Math.PI / 2);
      B.box('sofa', 0.7, 0.4, 0.66, 0, 0.26, 0);
      B.box('sofa', 0.7, 0.55, 0.16, 0, 0.7, -0.27);
      for (const e of [-1, 1]) B.box('sofa', 0.12, 0.25, 0.66, e * 0.35, 0.52, 0);
      B.box('sofaCushion', 0.52, 0.1, 0.56, 0, 0.5, 0.02);
      B.plane('shRound', 1.1, 1.1, 0, 0.004, 0, -Math.PI / 2);
      B.pop();
    }
    // tall cases for the bridal sets
    const cases = [
      [-1, 1.9],
      [-1, 3.9],
      [1, 1.6],
    ];
    cases.forEach(([sd, cvz], i) => {
      const cu = sd * (W / 2 - 0.24),
        cl = 1.3,
        base = 0.86,
        top = 2.25;
      B.box('lacquer', 0.48, base, cl, cu, base / 2, cvz);
      B.box('gold', 0.01, 0.05, cl, cu - sd * 0.242, 0.08, cvz);
      B.box('velvet_lounge', 0.46, 0.014, cl - 0.02, cu, base + 0.007, cvz);
      B.plane(
        'velvet_lounge',
        cl - 0.02,
        top - base,
        sd * (W / 2 - 0.01),
        (base + top) / 2,
        cvz,
        0,
        (-sd * Math.PI) / 2,
      );
      B.box('glass', 0.006, top - base, cl, cu - sd * 0.24, (base + top) / 2, cvz, { uv: false });
      B.box('glass', 0.48, 0.006, cl, cu, top, cvz, { uv: false });
      for (const e of [-1, 1])
        B.box('glass', 0.48, top - base, 0.006, cu, (base + top) / 2, cvz + (e * cl) / 2, { uv: false });
      for (const e of [-1, 1])
        B.box('gold', 0.016, top - base, 0.016, cu - sd * 0.24, (base + top) / 2, cvz + (e * cl) / 2);
      B.box('lacquer', 0.5, 0.08, cl + 0.02, cu, top + 0.04, cvz);
      B.box('glow', 0.02, 0.01, cl - 0.1, cu - sd * 0.18, top - 0.02, cvz);
      B.plane('pool', 0.6, cl, cu, base + 0.016, cvz, -Math.PI / 2);
      B.plane('shRect', 0.9, 1.6, cu - sd * 0.1, 0.004, cvz, -Math.PI / 2);
      const set = NY.SETS.find((s) => s.id === NY.MERCH.lounge.cases[i]);
      const facing = Ry(sd < 0 ? Math.PI / 2 : -Math.PI / 2);
      const ids = set.pieces;
      const neck = ids.find((id) => /necklace|pendant/.test(NY.byId[id].type));
      const others = ids.filter((id) => id !== neck);
      if (neck) slot('lounge', 'case', [neck], T(cu + sd * 0.05, base + 0.015, cvz).multiply(facing));
      others.slice(0, 3).forEach((id, j) => {
        const off = [-0.45, 0.45, 0.25][j];
        slot('lounge', 'case', [id], T(cu + sd * 0.02, base + 0.015, cvz + off).multiply(facing));
      });
    });
    // try-on mirror on the right wall with a stool
    {
      const mu = W / 2 - 0.03,
        mz = 3.5;
      const ms = new THREE.Shape();
      ms.moveTo(-0.6, 0.35);
      ms.lineTo(0.6, 0.35);
      ms.lineTo(0.6, 1.75);
      ms.absarc(0, 1.75, 0.6, 0, Math.PI, false);
      const mg = new THREE.ShapeGeometry(ms, 24);
      mg.rotateY(-Math.PI / 2);
      mg.translate(mu, 0, mz);
      B.geo('mirror', mg);
      const mt = archCurve(1.2, 1.4, 0.05, 20).map((p) => new THREE.Vector3(mu - 0.01, 0.35 + p.y, mz - p.x));
      goldTube(mt, 0.04);
      B.box('gold', 0.05, 0.05, 1.3, mu - 0.01, 0.33, mz);
      B.hitbox('tryon', mu - 0.1, 1.3, mz, 0.2, 2.0, 1.3);
      B.plane('poolWall', 1.6, 2.4, mu - 0.005, 1.4, mz, 0, -Math.PI / 2);
      B.cyl('velvet_lounge', 0.2, 0.19, 0.08, mu - 0.75, 0.48, mz, 24);
      B.cyl('gold', 0.02, 0.02, 0.44, mu - 0.75, 0.22, mz, 8);
      B.plane('shRound', 0.6, 0.6, mu - 0.75, 0.004, mz, -Math.PI / 2);
    }
    // chandelier
    {
      const cz = (v0 + v1) / 2;
      B.cyl('gold', 0.01, 0.01, 1.0, 0, H - 0.5, cz, 6);
      for (const [r, y, n] of [
        [0.55, H - 1.05, 10],
        [0.32, H - 1.3, 6],
      ]) {
        B.torus('gold', r, 0.014, 0, y, cz, Math.PI / 2, 40);
        for (let i = 0; i < n; i++) {
          const a = (i / n) * TAU;
          const lx = Math.sin(a) * r,
            lz = cz + Math.cos(a) * r;
          B.sph('bulb', 0.02, lx, y + 0.08, lz, 1, 1.5, 1, 8);
          const p = f.toWorld(lx, lz);
          out.chandelier.gem('crystal', 'briolette', 0.032, [p[0], y - 0.07, p[1]], [0, 1, 0]);
        }
      }
      out.lights.push({ kind: 'lounge', pos: f.toWorld(0, cz).concat([H - 1.2]) });
    }
    B.pop();
  }
  return out;
}
