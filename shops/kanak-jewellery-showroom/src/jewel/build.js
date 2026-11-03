// Procedural jewellery: rings, earrings, necklaces, bangles, bracelets, maang tikka and nath, built in millimetres
// from the product's build spec. Every builder works in a fixed frame (see FRAMES), adds metal by slot ('m' the
// chosen metal, 'w' claws, 'ox' oxidised recesses) and stones by role ('@main', '@accent', '@drop', '@pearl'),
// so a change of metal or stone only swaps materials. q (0..1) is the level of detail: the store uses about 0.35,
// the product viewer and the try-on about 0.9.
import * as THREE from 'three';
import { Kit, T, R, S, mul, frameMatrix, appendKit } from './kit.js';
import { pavilionDepth, crownHeight, girdlePoint } from './gems.js';
import {
  sweep,
  profileD,
  profileFlat,
  profileKnife,
  profileRidged,
  profileRound,
  helixPath,
  wire,
  bead,
  torus,
  lathe,
  plate,
  polarOutline,
  flowerR,
  paisleyOutline,
  leafOutline,
  crescentOutline,
  crescentEdge,
  necklacePath,
  ellipsePath,
} from './shapes.js';

const TAU = Math.PI * 2;
const V3 = THREE.Vector3;

/** Frames each builder uses (documented for the try-on and the store displays). */
export const FRAMES = {
  ring: 'Ring axis along z (the finger), head at +y, centre of the finger hole at the origin.',
  earrings: 'One earring: the piercing at the origin, hanging along -y, front facing +z. Pairs are spaced along x.',
  necklace: 'Bust frame: neck base at y = 0, y up, front of the chest towards +z.',
  bangle: 'Bangle axis along z (the wrist), centre at the origin.',
  tikka: 'Hook at the origin (hair parting), hanging along -y, front facing +z.',
  nath: 'Piercing point at the origin, ring in the x-y plane, front facing +z.',
};

/* ---------------------------------------------------------------- helpers */
function addM(kit, slot, g) {
  if (Array.isArray(g)) for (const x of g) kit.metalGeo(slot, x);
  else kit.metalGeo(slot, g);
}
const lerp = (a, b, t) => a + (b - a) * t;
const rot2 = (x, y, a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
const detail = (q, lo, hi) => Math.round(lo + (hi - lo) * Math.max(0, Math.min(1, q)));

/** Carat weight -> girdle width in mm, for a cut (standard proportions). */
export function stoneMM(cut, ct) {
  const round = 6.45 * Math.cbrt(ct); // 1 ct round ~ 6.4-6.5 mm
  const k = {
    round: 1,
    oval: 0.86,
    pear: 0.82,
    marquise: 0.72,
    cushion: 0.94,
    princess: 0.86,
    emerald: 0.84,
    heart: 0.96,
    asscher: 0.82,
  }[cut];
  return round * (k || 1);
}
/** Approximate carat weight of a stone of girdle width w (mm), for price and certificate lines. */
export function stoneCt(cut, w) {
  return Math.pow(w / stoneMM(cut, 1), 3);
}

/* ---------------------------------------------------------------- settings */
/** Prongs around a stone whose girdle centre is at the current origin, table +y. yBase: where the prongs start. */
function prongs(kit, slot, cut, D, n, yBase, o) {
  o = o || {};
  const pd = pavilionDepth(cut) * D,
    ch = crownHeight(cut) * D;
  const pr = o.r || Math.max(0.3, D * 0.068);
  const angles =
    o.angles ||
    Array.from({ length: n }, (_, k) => ((k + 0.5) / n) * TAU + (o.rot || 0) + (n === 4 && cut === 'round' ? 0 : 0));
  for (const a of angles) {
    const gp = girdlePoint(cut, a);
    const rr = Math.hypot(gp[0], gp[1]) * D,
      dx = gp[0] / Math.hypot(gp[0], gp[1]),
      dz = gp[1] / Math.hypot(gp[0], gp[1]);
    const pts = [
      [dx * rr * 0.32, yBase, dz * rr * 0.32],
      [dx * rr * 0.8, -pd * 0.5, dz * rr * 0.8],
      [dx * (rr + pr * 0.6), -0.04 * D, dz * (rr + pr * 0.6)],
      [dx * (rr * 0.9), ch * 0.5, dz * (rr * 0.9)],
    ];
    addM(kit, slot, wire(pts, pr, { radial: o.q > 0.6 ? 8 : 5, seg: o.q > 0.6 ? 18 : 8, caps: false }));
    kit.metalGeo(slot, bead(pr * 1.18, pts[3][0], pts[3][1], pts[3][2], o.q > 0.6 ? 1 : 0));
  }
  if (o.gallery !== false) {
    const gy = -pd * 0.52,
      ring = [];
    const m = 24;
    for (let i = 0; i < m; i++) {
      const gp = girdlePoint(cut, (i / m) * TAU);
      ring.push([gp[0] * D * 0.66, gy, gp[1] * D * 0.66]);
    }
    addM(kit, slot, wire(ring, pr * 0.72, { closed: true, radial: 6, seg: 48 }));
  }
}
/** Bezel (rub-over) collar around a stone at the origin. h: collar height. */
function bezel(kit, slot, cut, D, o) {
  o = o || {};
  const t = o.t || Math.max(0.35, D * 0.07),
    h = o.h || Math.max(0.9, D * 0.32);
  const ch = crownHeight(cut) * D;
  const nu = o.q > 0.6 ? 48 : 28;
  const path = (u) => {
    const a = u * TAU,
      e = 1e-3;
    const p = girdlePoint(cut, a),
      p2 = girdlePoint(cut, a + e);
    const len = Math.hypot(p[0], p[1]) || 1;
    const sc = (D / 2 + t * 0.5) / (D / 2);
    const tx = p2[0] - p[0],
      tz = p2[1] - p[1];
    return {
      p: [p[0] * D * sc, ch * 0.25 - h / 2, p[1] * D * sc],
      t: [tx, 0, tz],
      n: [p[0] / len, 0, p[1] / len],
    };
  };
  kit.metalGeo(slot, sweep(path, profileFlat(t, h, 12, 6), { nu, closed: true }));
}
/** A cup under a stone (kundan and temple work): closes the setting from behind. */
function cup(kit, slot, D, depth) {
  const r = D * 0.55,
    d = depth || D * 0.35;
  const g = lathe(
    [
      [0, -d],
      [r * 0.6, -d * 0.92],
      [r, -d * 0.4],
      [r * 1.02, 0],
    ],
    20,
  );
  kit.metalGeo(slot, g);
}
/** Small round stones (pave) with bead claws. pts: [{ p:[x,y,z], up:[x,y,z], x:[...] }] */
function pave(kit, pts, s, q, o) {
  o = o || {};
  for (const e of pts) {
    kit.gem(o.role || '@accent', 'round', s, e.p, e.up, e.x || [1, 0, 0]);
    if (q > 0.55 && o.beads !== false) {
      const up = new V3(...e.up).normalize();
      const xd = new V3(...(e.x || [1, 0, 0]));
      xd.addScaledVector(up, -xd.dot(up)).normalize();
      const zd = new V3().crossVectors(xd, up);
      for (const [a, b] of [
        [1, 1],
        [-1, 1],
        [1, -1],
        [-1, -1],
      ]) {
        const p = new V3(...e.p)
          .addScaledVector(xd, a * s * 0.42)
          .addScaledVector(zd, b * s * 0.42)
          .addScaledVector(up, s * 0.08);
        kit.metalGeo(o.slot || 'w', bead(s * 0.13, p.x, p.y, p.z, 0));
      }
    }
  }
}

/* ---------------------------------------------------------------- motifs (facing +z, hanging from the origin) */
function jumpRing(kit, slot, r, x, y, z, rotY) {
  const g = torus(r, r * 0.28, 6, 16);
  if (rotY) g.rotateY(rotY);
  g.translate(x, y, z);
  kit.metalGeo(slot, g);
}
/** Granules along a 2D outline at depth z (temple work). */
function granules(kit, slot, outline, r, z, every, q) {
  if (q < 0.3) return;
  for (let i = 0; i < outline.length; i += every || 1) {
    const p = outline[i];
    kit.metalGeo(slot, bead(r, p[0], p[1], z, q > 0.7 ? 1 : 0));
  }
}
function scaleOutline(o, s, dx, dy) {
  return o.map((p) => [p[0] * s + (dx || 0), p[1] * s + (dy || 0)]);
}
/** Pearl drop hanging from (x, y, z): a bead or two and a pearl, along -y. */
function pearlDrop(kit, x, y, z, r, o) {
  o = o || {};
  const slot = o.slot || 'm';
  jumpRing(kit, slot, r * 0.32, x, y - r * 0.25, z, Math.PI / 2);
  let yy = y - r * 0.55;
  if (o.bead) {
    kit.gem(o.bead, 'cabochon', r * 0.9, [x, yy - r * 0.4, z], [0, 0, 1]);
    yy -= r * 0.9;
  }
  if (o.gem) {
    kit.gem(o.gem, 'round', r * 1.1, [x, yy - r * 0.6, z], [0, 0, 1]);
    kit.metalGeo(slot, bead(r * 0.2, x, yy - r * 0.05, z, 0));
    yy -= r * 1.15;
  }
  kit.pearl(o.pearl || '@pearl', r, [x, yy - r, z]);
  kit.metalGeo(slot, bead(r * 0.22, x, yy - 0.05, z, 0)); // cap
}

/** Motifs used in necklaces, chokers, tikkas and earrings. size: height in mm. */
function motif(kit, type, size, o, q) {
  o = o || {};
  const slot = o.slot || 'm';
  const s = size;
  switch (type) {
    case 'coin': {
      // temple coin (kasu): domed disc with a beaded rim and a flower boss, jump ring on top
      const r = s * 0.42;
      const g = lathe(
        [
          [0, 0.55],
          [r * 0.3, 0.6],
          [r * 0.55, 0.42],
          [r * 0.8, 0.5],
          [r * 0.9, 0.8],
          [r, 0.55],
          [r, -0.25],
          [0, -0.35],
        ],
        detail(q, 18, 36),
      );
      g.rotateX(Math.PI / 2);
      g.translate(0, -r - 0.8, 0);
      kit.metalGeo(slot, g);
      const boss = plate(polarOutline(flowerR(r * 0.42, 8, 0.35, 0.7), detail(q, 24, 48)), 0.4, 0.15);
      boss.translate(0, -r - 0.8, 0.75);
      kit.metalGeo(slot, boss);
      if (q > 0.45)
        granules(
          kit,
          slot,
          polarOutline(() => r * 0.72, detail(q, 12, 22), 0, -r - 0.8),
          0.32,
          0.9,
          1,
          q,
        );
      if (o.gem) kit.gem(o.gem, 'cabochon', r * 0.45, [0, -r - 0.8, 1.05], [0, 0, 1]);
      jumpRing(kit, slot, 0.9, 0, -0.6, 0, Math.PI / 2);
      return { bottom: -2 * r - 0.8, width: 2 * r };
    }
    case 'petal': {
      // kundan flower: petal plate, centre stone, small stones in the petals
      const r = s * 0.5;
      const pl = plate(polarOutline(flowerR(r, o.petals || 8, 0.28, 0.5), detail(q, 32, 72)), 0.9, 0.35);
      pl.translate(0, -r, 0);
      kit.metalGeo(slot, pl);
      const D = r * (o.centre || 0.95);
      kit.push(T(0, -r, 0.8 + r * 0.1));
      kit.gem(o.gem || '@main', o.cut || 'polki', D, [0, 0, 0], [0, 0, 1]);
      kit.push(R(Math.PI / 2, 0, 0));
      bezel(kit, slot, o.cut === 'round' ? 'round' : 'round', D, { t: 0.32, h: 0.9, q });
      kit.pop();
      kit.pop();
      if (o.accent && q > 0.3) {
        const n = o.petals || 8;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * TAU + Math.PI / n;
          const rr = r * 0.78;
          kit.gem(
            o.accent,
            o.accentCut || 'cabochon',
            r * 0.24,
            [Math.cos(a) * rr, -r + Math.sin(a) * rr, 0.75 + r * 0.04],
            [0, 0, 1],
          );
        }
      }
      jumpRing(kit, slot, 0.8, 0, -0.3, 0, Math.PI / 2);
      return { bottom: -2 * r, width: 2 * r };
    }
    case 'paisley': {
      const pl = plate(scaleOutline(paisleyOutline(detail(q, 36, 72), s), 1, 0, -s * 0.55), 1.0, 0.35);
      kit.metalGeo(slot, pl);
      kit.gem(o.gem || '@main', o.cut || 'pear', s * 0.36, [0, -s * 0.62, 0.85 + s * 0.06], [0, 0, 1], [1, 0, 0]);
      kit.push(T(0, -s * 0.62, 0.85 + s * 0.06));
      kit.push(R(Math.PI / 2, 0, 0));
      bezel(kit, slot, 'pear', s * 0.36, { t: 0.3, h: 0.8, q });
      kit.pop();
      kit.pop();
      if (o.accent && q > 0.3) {
        const edge = scaleOutline(paisleyOutline(18, s * 0.82), 1, 0, -s * 0.5);
        for (let i = 0; i < edge.length; i += 2)
          kit.gem(o.accent, 'round', s * 0.1, [edge[i][0], edge[i][1], 0.75 + s * 0.012], [0, 0, 1]);
      } else if (q > 0.45)
        granules(kit, slot, scaleOutline(paisleyOutline(26, s * 0.85), 1, 0, -s * 0.5), 0.3, 0.75, 1, q);
      jumpRing(kit, slot, 0.8, 0, -0.2, 0, Math.PI / 2);
      return { bottom: -s * 1.1, width: s * 0.75 };
    }
    case 'leaf': {
      const pl = plate(scaleOutline(leafOutline(detail(q, 24, 48), 0.3), s, 0, -s * 0.5), 0.8, 0.3);
      kit.metalGeo(slot, pl);
      if (o.gem) {
        const n = 3;
        for (let i = 0; i < n; i++) kit.gem(o.gem, 'round', s * 0.16, [0, -s * (0.25 + i * 0.25), 0.7], [0, 0, 1]);
      } else
        addM(
          kit,
          slot,
          wire(
            [
              [0, -s * 0.08, 0.5],
              [0, -s * 0.5, 0.75],
              [0, -s * 0.92, 0.5],
            ],
            0.25,
            { radial: 5 },
          ),
        );
      jumpRing(kit, slot, 0.7, 0, -0.2, 0, Math.PI / 2);
      return { bottom: -s, width: s * 0.6 };
    }
    case 'collet': {
      // single stone in a round collet (riviera)
      const D = s;
      kit.push(T(0, -D * 0.6, 0));
      kit.gem(o.gem || '@main', o.cut || 'round', D, [0, 0, 0.2], [0, 0, 1]);
      kit.push(R(Math.PI / 2, 0, 0));
      bezel(kit, slot, o.cut || 'round', D, { t: Math.max(0.3, D * 0.07), h: D * 0.45, q });
      kit.pop();
      kit.pop();
      jumpRing(kit, slot, Math.max(0.5, D * 0.12), 0, -0.1, -0.3, Math.PI / 2);
      return { bottom: -D * 1.15, width: D * 1.1 };
    }
    case 'cluster': {
      // diamond flower: centre and six petals in claws
      const D = s * 0.36;
      kit.push(T(0, -s * 0.5, 0));
      kit.gem(o.gem || '@main', 'round', D, [0, 0, 0.3], [0, 0, 1]);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU + Math.PI / 6;
        const rr = D * 0.98;
        kit.gem(
          o.petal || o.gem || '@main',
          o.petalCut || 'marquise',
          D * 0.92,
          [Math.cos(a) * rr, Math.sin(a) * rr, 0.1],
          [0, 0, 1],
          [Math.cos(a), Math.sin(a), 0],
        );
      }
      const back = plate(polarOutline(flowerR(s * 0.48, 6, 0.3, 0.6), 36), 0.6, 0.2);
      back.translate(0, 0, -0.6);
      kit.metalGeo(slot, back);
      if (q > 0.5)
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * TAU;
          kit.metalGeo(slot, bead(0.3, Math.cos(a) * D * 0.6, Math.sin(a) * D * 0.6, 0.65, 0));
        }
      kit.pop();
      jumpRing(kit, slot, 0.7, 0, -0.2, 0, Math.PI / 2);
      return { bottom: -s, width: s };
    }
    case 'polki-oval': {
      // Mughal medallion: oval polki in a bezel, a ring of small diamonds, a gold frame with beading
      const W = s * 0.62;
      kit.push(T(0, -s * 0.5, 0));
      const fr = plate(
        polarOutline((t) => s * 0.5 * (1 - 0.18 * Math.cos(t) ** 2) * (1 + 0.04 * Math.cos(t * 16)), detail(q, 40, 96)),
        1.0,
        0.35,
      );
      fr.rotateZ(Math.PI / 2);
      kit.metalGeo(slot, fr);
      kit.gem(o.gem || '@main', 'polki', W, [0, 0, 0.9 + s * 0.05], [0, 0, 1], [0, 1, 0]);
      if (q > 0.3) {
        const n = detail(q, 10, 16);
        for (let i = 0; i < n; i++) {
          const a = (i / n) * TAU;
          kit.gem(
            o.accent || '@accent',
            'round',
            s * 0.1,
            [Math.cos(a) * s * 0.4 * 0.82, Math.sin(a) * s * 0.4, 0.75 + s * 0.018],
            [0, 0, 1],
          );
        }
      }
      kit.pop();
      jumpRing(kit, slot, 0.8, 0, -0.2, 0, Math.PI / 2);
      return { bottom: -s, width: s * 0.82 };
    }
    case 'mayur': {
      // peacock: paisley body with a fan of stones
      const body = motif(kit, 'paisley', s * 0.8, { gem: o.gem || '@main', cut: 'pear', slot }, q);
      for (let i = 0; i < 5; i++) {
        const a = Math.PI * (0.15 + (i / 4) * 0.7);
        kit.gem(
          o.accent || '@accent',
          'pear',
          s * 0.18,
          [Math.cos(a) * s * 0.55, -s * 0.3 + Math.sin(a) * s * 0.42, 0.6],
          [0, 0, 1],
          [Math.cos(a), Math.sin(a), 0],
        );
      }
      return body;
    }
    default:
      return motif(kit, 'petal', size, o, q);
  }
}

/* ---------------------------------------------------------------- rings */
function ringHead(kit, b, yTop, q) {
  const cut = b.cut || 'round',
    D = b.stoneMM || 5;
  const pd = pavilionDepth(cut) * D,
    ch = crownHeight(cut) * D;
  const yg = yTop + pd * 0.82 + 0.9;
  switch (b.head) {
    case 'solitaire':
    case 'halo':
    case 'cocktail': {
      kit.gem('@main', cut, D, [0, yg, 0]);
      kit.push(T(0, yg, 0));
      prongs(kit, 'w', cut, D, b.prongs || (cut === 'round' ? 6 : 4), yTop - yg - 0.2, { q });
      if (b.head !== 'solitaire') {
        // halo of small stones, one row (or two for cocktail rings)
        const rows = b.head === 'cocktail' ? 2 : 1;
        let off = 0.35;
        for (let row = 0; row < rows; row++) {
          const s = b.haloMM || Math.max(1.1, D * 0.17);
          const ringPts = [];
          const m = 200;
          for (let i = 0; i < m; i++) {
            const gp = girdlePoint(cut, (i / m) * TAU);
            const l = Math.hypot(gp[0], gp[1]);
            ringPts.push([gp[0] * D + (gp[0] / l) * (off + s / 2), gp[1] * D + (gp[1] / l) * (off + s / 2)]);
          }
          let per = 0;
          for (let i = 0; i < m; i++)
            per += Math.hypot(ringPts[(i + 1) % m][0] - ringPts[i][0], ringPts[(i + 1) % m][1] - ringPts[i][1]);
          const n = Math.max(8, Math.floor(per / (s + 0.22)));
          const step = per / n;
          let acc = 0,
            next = 0,
            k = 0;
          const pts = [];
          for (let i = 0; i < m && k < n; i++) {
            const a = ringPts[i],
              c = ringPts[(i + 1) % m];
            const seg = Math.hypot(c[0] - a[0], c[1] - a[1]);
            while (next <= acc + seg && k < n) {
              const t = (next - acc) / seg;
              pts.push([lerp(a[0], c[0], t), lerp(a[1], c[1], t)]);
              next += step;
              k++;
            }
            acc += seg;
          }
          const hy = -ch * 0.15 - row * 0.5;
          pave(
            kit,
            pts.map((p) => ({ p: [p[0], hy, p[1]], up: [0, 1, 0] })),
            s,
            q,
            { role: '@accent' },
          );
          // halo frame under the stones
          const fr = pts.map((p) => {
            const l = Math.hypot(p[0], p[1]);
            return [p[0] * (1 - 0.02 / l), hy - s * 0.42, p[1] * (1 - 0.02 / l)];
          });
          addM(kit, 'w', wire(fr, s * 0.32, { closed: true, radial: 6, seg: n * 3 }));
          off += s + 0.3;
        }
      }
      kit.pop();
      // cathedral shoulders rising to the basket
      const gp = girdlePoint(cut, 0);
      for (const sd of [-1, 1]) {
        const pts = [
          [sd * (b.innerR + 0.4) * Math.sin(0.62), (b.innerR + 0.6) * Math.cos(0.62) + 0.4, 0],
          [sd * gp[0] * D * 0.75, yg - pd * 0.75, 0.2],
          [sd * gp[0] * D * 0.62, yg - pd * 0.52, 0],
        ];
        addM(kit, 'm', wire(pts, Math.max(0.45, D * 0.07), { radial: 6, seg: 12 }));
      }
      return yg + ch;
    }
    case 'three': {
      kit.gem('@main', cut, D, [0, yg, 0]);
      kit.push(T(0, yg, 0));
      prongs(kit, 'w', cut, D, 4, yTop - yg - 0.2, { q, rot: Math.PI / 4 - Math.PI / 4 });
      kit.pop();
      const Ds = D * 0.68;
      for (const sd of [-1, 1]) {
        const x = sd * (D * 0.5 + Ds * 0.5 + 0.35);
        const y = yg - 0.7;
        const tilt = -sd * 0.22;
        kit.push(mul(T(x, y, 0), R(0, 0, tilt)));
        kit.gem('@side', b.sideCut || 'round', Ds, [0, 0, 0]);
        prongs(kit, 'w', b.sideCut || 'round', Ds, 4, -Ds * 0.7, { q });
        kit.pop();
      }
      return yg + ch;
    }
    case 'cluster': {
      const D0 = D,
        D1 = D * 0.82;
      kit.push(T(0, yg - 0.2, 0));
      kit.gem('@main', 'round', D0, [0, 0, 0]);
      prongs(kit, 'w', 'round', D0, 4, -pd - 0.6, { q, gallery: false });
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU;
        const rr = (D0 + D1) / 2 + 0.15;
        kit.gem(
          '@accent',
          b.petalCut || 'round',
          D1,
          [Math.cos(a) * rr, -0.35, Math.sin(a) * rr],
          [Math.cos(a) * 0.18, 1, Math.sin(a) * 0.18],
          [Math.cos(a), 0, Math.sin(a)],
        );
        kit.metalGeo(
          'w',
          bead(D1 * 0.12, Math.cos(a + 0.52) * rr * 1.04, -0.2, Math.sin(a + 0.52) * rr * 1.04, q > 0.6 ? 1 : 0),
        );
      }
      const base = lathe(
        [
          [0, -pd - 0.8],
          [D0 * 0.9, -pd * 0.6],
          [D0 * 1.35, -0.45],
          [D0 * 1.35, -0.25],
        ],
        32,
      );
      kit.metalGeo('w', base);
      kit.pop();
      return yg + ch;
    }
    case 'polki':
    case 'navratna': {
      // a flower: centre stone in a collet, eight around it in collets, on a gold petal plate
      const plateR = D * 1.25;
      kit.push(mul(T(0, yTop + 1.6, 0), R(-Math.PI / 2, 0, 0)));
      const pl = plate(polarOutline(flowerR(plateR, 8, 0.25, 0.55), detail(q, 40, 80)), 1.4, 0.45);
      kit.metalGeo('m', pl);
      const centreCut = b.head === 'polki' ? 'polki' : 'cabochon';
      kit.gem(b.head === 'polki' ? '@main' : 'ruby', centreCut, D * 0.9, [0, 0, 1.1], [0, 0, 1]);
      kit.push(R(Math.PI / 2, 0, 0));
      kit.push(T(0, 1.1, 0));
      bezel(kit, 'm', 'round', D * 0.9, { t: 0.4, h: 1.2, q });
      kit.pop();
      kit.pop();
      const NAV = ['diamond', '@pearl', 'coral', 'emerald', 'yellow', 'sapphire', 'hessonite', 'cat'];
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU + Math.PI / 8;
        const rr = plateR * 0.72,
          x = Math.cos(a) * rr,
          y = Math.sin(a) * rr;
        const kind = b.head === 'polki' ? '@accent' : NAV[i];
        const s = D * 0.38;
        if (kind === '@pearl') kit.pearl('@pearl', s * 0.48, [x, y, 1.2]);
        else
          kit.gem(
            kind,
            b.head === 'polki' ? 'cabochon' : kind === 'diamond' ? 'round' : 'cabochon',
            s,
            [x, y, 0.9],
            [0, 0, 1],
          );
        if (q > 0.4) {
          kit.push(mul(T(x, y, 0.9), R(Math.PI / 2, 0, 0)));
          bezel(kit, 'm', 'round', s, { t: 0.25, h: 0.7, q });
          kit.pop();
        }
      }
      if (q > 0.5) granules(kit, 'm', polarOutline(flowerR(plateR * 0.98, 8, 0.25, 0.55), 64), 0.28, 0.75, 2, q);
      kit.pop();
      return yTop + 4;
    }
    case 'signet': {
      // flat top face with an onyx inlay and a small diamond
      const w = b.faceW || 12,
        l = b.faceL || 10;
      const face = plate(
        polarOutline(
          (t) =>
            1 /
            Math.pow(Math.pow(Math.abs(Math.cos(t)) / (w / 2), 4) + Math.pow(Math.abs(Math.sin(t)) / (l / 2), 4), 0.25),
          48,
        ),
        2.2,
        0.6,
      );
      face.rotateX(-Math.PI / 2);
      face.translate(0, yTop + 0.6, 0);
      kit.metalGeo('m', face);
      const inl = plate(
        polarOutline(
          (t) =>
            1 /
            Math.pow(
              Math.pow(Math.abs(Math.cos(t)) / (w / 2 - 1.3), 4) + Math.pow(Math.abs(Math.sin(t)) / (l / 2 - 1.3), 4),
              0.25,
            ),
          48,
        ),
        0.6,
        0.15,
      );
      inl.rotateX(-Math.PI / 2);
      inl.translate(0, yTop + 2.05, 0);
      kit.enamelGeo('black', inl);
      kit.gem('@main', 'round', b.stoneMM || 2.4, [0, yTop + 2.35, 0]);
      kit.push(T(0, yTop + 2.35, 0));
      bezel(kit, 'm', 'round', b.stoneMM || 2.4, { t: 0.35, h: 0.7, q });
      kit.pop();
      return yTop + 3;
    }
    case 'flush': {
      // gypsy setting: a stone sunk into a wide band
      kit.gem('@main', 'round', D, [0, yTop - 0.15, 0]);
      kit.push(T(0, yTop - 0.15, 0));
      bezel(kit, 'w', 'round', D, { t: 0.45, h: 0.8, q });
      kit.pop();
      return yTop + 1;
    }
    default:
      return yTop;
  }
}
export function buildRing(b, cfg, q) {
  const kit = new Kit();
  const Rin = (cfg.ringDia || 17) / 2;
  const th = b.thick || 1.7,
    wd = b.width || 2.3;
  const headT = b.head && b.head !== 'band' && b.head !== 'eternity' ? (b.headT == null ? 0.18 : b.headT) : 0,
    headW = b.head && b.head !== 'band' && b.head !== 'eternity' ? (b.headW == null ? 0.25 : b.headW) : 0;
  const k = (a) => {
    const d = a > Math.PI ? a - TAU : a;
    return Math.exp(-(d * d) / (2 * 0.5 * 0.5));
  };
  const prof =
    b.band === 'flat'
      ? profileFlat(th, wd, detail(q, 12, 20))
      : b.band === 'knife'
        ? profileKnife(th, wd, detail(q, 12, 18))
        : b.band === 'ridged'
          ? profileRidged(th, wd, b.ridges || 3, 0.25, detail(q, 24, 40))
          : profileD(th, wd, detail(q, 12, 20));
  const path = (u) => {
    const a = u * TAU,
      s = Math.sin(a),
      c = Math.cos(a);
    const kk = k(a);
    const rr = Rin + (th / 2) * (1 + headT * kk);
    return { p: [rr * s, rr * c, 0], t: [c, -s, 0], n: [s, c, 0], s: [1 + headT * kk, 1 + headW * kk] };
  };
  kit.metalGeo('m', sweep(path, prof, { nu: detail(q, 64, 140), closed: true }));
  const yTop = Rin + th * (1 + headT);
  // eternity and diamond bands: stones along the band's top surface
  if (b.head === 'eternity' || b.head === 'band-diamond') {
    const s = b.stoneMM || 2.2;
    const full = b.head === 'eternity';
    const span = full ? TAU : b.span || 2.0;
    const Rs = Rin + th + 0.05;
    const n = Math.floor((span * Rs) / (s + 0.2));
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = (full ? 0 : -span / 2) + ((i + (full ? 0 : 0.5)) / n) * span;
      pts.push({
        p: [Rs * Math.sin(a), Rs * Math.cos(a), 0],
        up: [Math.sin(a), Math.cos(a), 0],
        x: [Math.cos(a), -Math.sin(a), 0],
      });
    }
    pave(kit, pts, s, q, { role: '@main', slot: 'w' });
  } else if (b.head && b.head !== 'band') {
    b.innerR = Rin;
    ringHead(kit, b, yTop, q);
  }
  // shoulder pave
  if (b.pave) {
    const s = b.paveMM || 1.15;
    const pts = [];
    const Rs = Rin + th * 1.02;
    for (const sd of [-1, 1]) {
      for (let a = 0.42; a < (b.paveTo || 1.15); a += (s + 0.18) / Rs) {
        const aa = sd * a;
        pts.push({
          p: [Rs * Math.sin(aa), Rs * Math.cos(aa), 0],
          up: [Math.sin(aa), Math.cos(aa), 0],
          x: [Math.cos(aa), -Math.sin(aa), 0],
        });
      }
    }
    pave(kit, pts, s, q, { role: '@accent' });
  }
  // milgrain edges on plain bands
  if (b.milgrain && q > 0.5) {
    const Rs = Rin + th * 0.92;
    const n = Math.floor((TAU * Rs) / 0.55);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      for (const z of [-wd / 2, wd / 2]) kit.metalGeo('m', bead(0.22, Rs * Math.sin(a), Rs * Math.cos(a), z, 0));
    }
  }
  kit.anchor('centre', [0, 0, 0]);
  kit.anchors.innerR = Rin;
  return kit;
}

/* ---------------------------------------------------------------- earrings */
function earring(kit, b, q) {
  const D = b.stoneMM || 5;
  switch (b.style) {
    case 'stud': {
      kit.gem('@main', b.cut || 'round', D, [0, 0, 0.6], [0, 0, 1], [1, 0, 0]);
      kit.push(mul(T(0, 0, 0.6), R(Math.PI / 2, 0, 0)));
      prongs(kit, 'w', b.cut || 'round', D, b.prongs || 4, -pavilionDepth(b.cut || 'round') * D - 0.4, {
        q,
        rot: Math.PI / 4 - Math.PI / 4,
      });
      kit.pop();
      addM(
        kit,
        'm',
        wire(
          [
            [0, 0, -1],
            [0, 0, -9],
          ],
          0.42,
          { radial: 6 },
        ),
      );
      return { bottom: -D * 0.55 };
    }
    case 'cluster': {
      kit.push(T(0, D * 0.5, 0.4));
      motif(kit, 'cluster', D * 2.6, { gem: '@main', petal: '@accent', slot: 'w' }, q);
      kit.pop();
      addM(
        kit,
        'm',
        wire(
          [
            [0, -D * 0.8, -1],
            [0, -D * 0.8, -9],
          ],
          0.42,
          { radial: 6 },
        ),
      );
      return { bottom: -D * 2.2 };
    }
    case 'drop': {
      // small stud on top, a link, and a pear drop with the point up
      const d1 = b.topMM || 3;
      kit.gem('@accent', 'round', d1, [0, 0, 0.5], [0, 0, 1]);
      kit.push(mul(T(0, 0, 0.5), R(Math.PI / 2, 0, 0)));
      prongs(kit, 'w', 'round', d1, 4, -d1 * 0.5, { q, gallery: false });
      kit.pop();
      addM(
        kit,
        'm',
        wire(
          [
            [0, 0, -1],
            [0, 0, -9],
          ],
          0.42,
          { radial: 6 },
        ),
      );
      jumpRing(kit, 'w', 0.8, 0, -d1 * 0.62 - 0.6, 0.2, 0);
      const W = b.dropMM || 7,
        cut = b.dropCut || 'pear';
      const half = (cut === 'pear' ? 0.62 : 0.5) * W;
      const yC = -d1 * 0.62 - 1.6 - half;
      // the pear's point (+z in stone frame) faces up (+y): stone x along world x, up along +z
      kit.gem('@drop', cut, W, [0, yC, 0.4], [0, 0, 1], [-1, 0, 0]);
      kit.push(mul(T(0, yC, 0.4), R(Math.PI / 2, 0, 0), R(0, Math.PI, 0)));
      bezel(kit, 'w', cut, W, { t: 0.32, h: W * 0.2, q });
      kit.pop();
      return { bottom: yC - W * 0.45 };
    }
    case 'jhumka': {
      const top = b.topMM || 13;
      kit.push(T(0, top * 0.5, 0.3));
      const m = motif(
        kit,
        'petal',
        top,
        { gem: '@main', cut: b.topCut || 'polki', accent: b.accent || null, petals: 8 },
        q,
      );
      kit.pop();
      addM(
        kit,
        'm',
        wire(
          [
            [0, 0, -0.8],
            [0, 0, -9],
          ],
          0.42,
          { radial: 6 },
        ),
      );
      let y = top * 0.5 + m.bottom - 0.4;
      // connector beads
      kit.metalGeo('m', bead(0.9, 0, y - 0.7, 0, q > 0.6 ? 2 : 1));
      kit.metalGeo('m', bead(0.6, 0, y - 1.9, 0, 1));
      y -= 2.5;
      // the bell
      const Rb = b.bellR || 9,
        Hb = b.bellH || 12,
        th = 0.55;
      const outer = [];
      const n = detail(q, 10, 18);
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const r =
          1.0 + (Rb - 1) * Math.pow(Math.sin((t * Math.PI) / 2), 1.35) + (t > 0.85 ? (t - 0.85) * Rb * 0.25 : 0);
        outer.push([r, -t * Hb]);
      }
      const inner = outer
        .slice()
        .reverse()
        .map(([r, yy]) => [Math.max(0.4, r - th), yy + th * 0.6]);
      const bell = lathe(outer.concat([[outer[n][0] - th * 0.5, -Hb - 0.35]], inner), detail(q, 24, 56));
      bell.translate(0, y, 0);
      kit.metalGeo('m', bell);
      // rim and bands of granules or stones
      const rim = torus(Rb + Rb * 0.04, 0.5, 6, detail(q, 32, 72));
      rim.rotateX(Math.PI / 2);
      rim.translate(0, y - Hb, 0);
      kit.metalGeo('m', rim);
      for (const [tt, kind] of [
        [0.45, b.band || null],
        [0.75, null],
      ]) {
        const yy = y - tt * Hb;
        const rr = 1.0 + (Rb - 1) * Math.pow(Math.sin((tt * Math.PI) / 2), 1.35) + 0.25;
        const cnt = Math.floor((TAU * rr) / (kind ? 1.8 : 1.0));
        if (q < 0.35 && !kind) continue;
        for (let i = 0; i < cnt; i++) {
          const a = (i / cnt) * TAU;
          if (kind)
            kit.gem(kind, 'round', 1.5, [Math.cos(a) * rr, yy, Math.sin(a) * rr], [Math.cos(a), 0.25, Math.sin(a)]);
          else kit.metalGeo('m', bead(0.4, Math.cos(a) * rr, yy, Math.sin(a) * rr, 0));
        }
      }
      // pearl drops around the rim
      const nd = b.drops || detail(q, 10, 16);
      for (let i = 0; i < nd; i++) {
        const a = (i / nd) * TAU;
        const x = Math.cos(a) * (Rb + 0.2),
          z = Math.sin(a) * (Rb + 0.2);
        jumpRing(kit, 'm', 0.45, x, y - Hb - 0.6, z, a);
        kit.pearl('@pearl', b.pearlR || 1.25, [x, y - Hb - 2.1, z]);
      }
      // clapper
      kit.pearl('@pearl', 1.6, [0, y - Hb - 1.2, 0]);
      return { bottom: y - Hb - 3.5 };
    }
    case 'chandbali': {
      const Rc = b.size || 14;
      kit.push(T(0, b.topMM ? 0 : 0, 0));
      const tm = b.topMM || 8;
      kit.push(T(0, tm * 0.5, 0.3));
      const m = motif(kit, 'petal', tm, { gem: '@main', cut: 'polki', petals: 6 }, q);
      kit.pop();
      addM(
        kit,
        'm',
        wire(
          [
            [0, 0, -0.8],
            [0, 0, -9],
          ],
          0.42,
          { radial: 6 },
        ),
      );
      const yTop = tm * 0.5 + m.bottom - 1.0;
      // crescent: horns up, its top at yTop
      const ri = 0.7,
        sh = 0.42;
      const yi = (1 - ri * ri + sh * sh) / (2 * sh);
      const cy = yTop - yi * Rc;
      const cres = scaleOutline(crescentOutline(detail(q, 28, 64), ri, sh), Rc, 0, cy);
      kit.metalGeo('m', plate(cres, 1.3, 0.4, { bulge: 0 }));
      // raised rim along the crescent catches the light
      addM(
        kit,
        'm',
        wire(cres.map((p) => [p[0], p[1], 0.75]).concat([[cres[0][0], cres[0][1], 0.75]]), 0.42, {
          radial: 6,
          seg: cres.length * 3,
          caps: false,
        }),
      );
      jumpRing(kit, 'm', 0.7, -Math.sqrt(1 - yi * yi) * Rc * 0.95, yTop - 0.3, 0, Math.PI / 2);
      jumpRing(kit, 'm', 0.7, Math.sqrt(1 - yi * yi) * Rc * 0.95, yTop - 0.3, 0, Math.PI / 2);
      addM(
        kit,
        'm',
        wire(
          [
            [-Math.sqrt(1 - yi * yi) * Rc * 0.95, yTop - 0.3, 0],
            [0, yTop + 0.6, 0],
            [Math.sqrt(1 - yi * yi) * Rc * 0.95, yTop - 0.3, 0],
          ],
          0.35,
          { radial: 5 },
        ),
      );
      // stones along the crescent's middle band, small stones near the edge, pearls hanging
      const mid = crescentEdge(detail(q, 7, 9), ri, sh, 0.17);
      for (const [x, y] of mid) kit.gem('@main', 'polki-b', Rc * 0.2, [x * Rc, cy + y * Rc, 0.9], [0, 0, 1]);
      if (q > 0.4) {
        const edge = crescentEdge(detail(q, 14, 22), ri, sh, 0.05);
        for (const [x, y] of edge) kit.gem('@accent', 'round', Rc * 0.075, [x * Rc, cy + y * Rc, 0.75], [0, 0, 1]);
      }
      const drops = crescentEdge(b.drops || 13, ri, sh, -0.02);
      for (const [x, y] of drops) pearlDrop(kit, x * Rc, cy + y * Rc, 0, b.pearlR || 1.3, {});
      kit.pop();
      return { bottom: cy - Rc - 4 };
    }
    case 'hoop': {
      const Rh = b.size || 9,
        r = b.wire || 1.3;
      const arc = TAU * 0.86;
      const g = sweep(
        (u) => {
          const a = Math.PI / 2 + TAU * 0.07 + u * arc;
          return {
            p: [Rh * Math.cos(a), -Rh + Rh * Math.sin(a), 0],
            t: [-Math.sin(a), Math.cos(a), 0],
            n: [Math.cos(a), Math.sin(a), 0],
          };
        },
        profileFlat(r * 1.4, r * 1.6, 12, 4),
        { nu: detail(q, 40, 90) },
      );
      kit.metalGeo('m', g);
      if (b.pave) {
        const s = b.paveMM || 1.3;
        const pts = [];
        for (let a = -Math.PI * 0.95; a < -Math.PI * 0.05; a += (s + 0.2) / Rh) {
          pts.push({
            p: [Rh * Math.cos(a) * 1.0, -Rh + Rh * Math.sin(a), r * 0.75],
            up: [0, 0, 1],
            x: [Math.cos(a), Math.sin(a), 0],
          });
        }
        pave(kit, pts, s, q, { role: '@main', slot: 'w' });
      }
      return { bottom: -2 * Rh };
    }
    default:
      return earring(kit, Object.assign({}, b, { style: 'stud' }), q);
  }
}
export function buildEarrings(b, cfg, q, single) {
  const kit = new Kit();
  const one = new Kit();
  const r = earring(one, b, q);
  const gap = (b.gap || 24) + (b.size || 0);
  if (single) appendKit(kit, one, new THREE.Matrix4());
  else {
    appendKit(kit, one, T(-gap / 2, 0, 0));
    appendKit(kit, one, T(gap / 2, 0, 0));
  }
  kit.anchors.bottom = r.bottom;
  kit.anchors.gap = single ? 0 : gap;
  kit.single = one;
  return kit;
}

/* ---------------------------------------------------------------- necklaces */
/** Cable chain along a curve (array of Vector3 or a curve), from u0 to u1 (fractions of length). */
function chainAlong(kit, slot, curve, u0, u1, link, q, o) {
  o = o || {};
  const L = curve.getLength() * Math.abs(u1 - u0);
  if (q < 0.5 || o.tube) {
    const n = Math.max(8, Math.round(L / 3));
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const p = curve.getPointAt((((u0 + ((u1 - u0) * i) / n) % 1) + 1) % 1);
      pts.push([p.x, p.y, p.z]);
    }
    addM(kit, slot, wire(pts, link * 0.36, { radial: q < 0.3 ? 4 : 6, seg: n * 2, caps: false }));
    return;
  }
  const pitch = link * 0.82;
  const n = Math.floor(L / pitch);
  const base = torus(1, 0.24, 5, 10);
  base.scale(link * 0.5, link * 0.34, link * 0.5);
  const m = new THREE.Matrix4(),
    up = new V3(0, 1, 0);
  for (let i = 0; i < n; i++) {
    const u = (((u0 + ((u1 - u0) * (i + 0.5)) / n) % 1) + 1) % 1;
    const p = curve.getPointAt(u),
      t = curve.getTangentAt(u);
    // link: long axis along the tangent, alternate links turned 90 degrees
    const side = new V3().crossVectors(t, up);
    if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
    side.normalize();
    const nrm = new V3().crossVectors(side, t).normalize();
    const X = t.clone(),
      Y = i % 2 ? nrm : side,
      Z = new V3().crossVectors(X, Y);
    m.makeBasis(X, Y, Z).setPosition(p);
    const g = base.clone().rotateX(Math.PI / 2);
    // torus lies in its x-y plane: rotate so the ring plane holds the tangent
    g.applyMatrix4(m);
    kit.metalGeo(slot, g);
  }
}
/** Pendant: bail at the origin, hanging along -y, facing +z. */
function pendant(kit, b, q) {
  const s = b.pendantMM || 12;
  // bail
  const bail = sweep(
    (u) => {
      const a = Math.PI * 1.1 * (u - 0.5) * 2;
      return {
        p: [0, 1.6 * Math.cos(a) - 1.6, 1.6 * Math.sin(a)],
        t: [0, -Math.sin(a), Math.cos(a)],
        n: [0, Math.cos(a), Math.sin(a)],
      };
    },
    profileFlat(0.8, 1.6, 10, 4),
    { nu: 20 },
  );
  kit.metalGeo('m', bail);
  kit.push(T(0, -3.4, 0));
  let bottom;
  switch (b.pendant) {
    case 'solitaire': {
      const D = b.stoneMM || 6,
        cut = b.cut || 'round';
      const half = cut === 'pear' ? 0.62 * D : 0.5 * D;
      kit.gem('@main', cut, D, [0, -half - 0.6, 0.3], [0, 0, 1], [cut === 'pear' ? -1 : 1, 0, 0]);
      kit.push(
        mul(T(0, -half - 0.6, 0.3), R(Math.PI / 2, 0, 0), cut === 'pear' ? R(0, Math.PI, 0) : new THREE.Matrix4()),
      );
      prongs(kit, 'w', cut, D, cut === 'pear' ? 3 : 4, -pavilionDepth(cut) * D - 0.4, {
        q,
        angles: cut === 'pear' ? [Math.PI / 2, Math.PI * 1.15, Math.PI * 1.85] : null,
      });
      kit.pop();
      bottom = -half * 2 - 0.6;
      break;
    }
    case 'halo-drop': {
      const D = b.stoneMM || 8,
        cut = b.cut || 'pear';
      const half = 0.62 * D;
      kit.gem('@main', cut, D, [0, -half - 1.5, 0.3], [0, 0, 1], [-1, 0, 0]);
      kit.push(mul(T(0, -half - 1.5, 0.3), R(Math.PI / 2, 0, 0), R(0, Math.PI, 0)));
      prongs(kit, 'w', cut, D, 3, -pavilionDepth(cut) * D - 0.4, {
        q,
        angles: [Math.PI / 2, Math.PI * 1.15, Math.PI * 1.85],
      });
      // halo
      const s = 1.15,
        pts = [];
      const m = 120;
      const ring = [];
      for (let i = 0; i < m; i++) {
        const gp = girdlePoint(cut, (i / m) * TAU);
        const l = Math.hypot(gp[0], gp[1]);
        ring.push([gp[0] * D + (gp[0] / l) * 0.9, gp[1] * D + (gp[1] / l) * 0.9]);
      }
      for (let i = 0; i < m; i += Math.max(1, Math.round(m / 26)))
        pts.push({ p: [ring[i][0], -0.3, ring[i][1]], up: [0, 1, 0] });
      pave(kit, pts, s, q, { role: '@accent' });
      addM(
        kit,
        'w',
        wire(
          ring.map((p) => [p[0], -0.75, p[1]]),
          0.4,
          { closed: true, radial: 5, seg: 80 },
        ),
      );
      kit.pop();
      bottom = -half * 2 - 2;
      break;
    }
    case 'heart': {
      const D = b.stoneMM || 7;
      kit.gem('@main', 'heart', D, [0, -D * 0.55, 0.3], [0, 0, 1], [1, 0, 0]);
      kit.push(mul(T(0, -D * 0.55, 0.3), R(Math.PI / 2, 0, 0)));
      prongs(kit, 'w', 'heart', D, 3, -pavilionDepth('heart') * D - 0.4, {
        q,
        angles: [Math.PI / 2, Math.PI * 1.2, Math.PI * 1.8],
      });
      kit.pop();
      bottom = -D * 1.1;
      break;
    }
    case 'infinity': {
      // figure eight in metal with pave on one loop
      const pts = [];
      const n = 48;
      for (let i = 0; i < n; i++) {
        const t = (i / n) * TAU;
        const d = 1 + Math.sin(t) ** 2;
        pts.push([
          (s * 0.55 * Math.cos(t)) / d,
          -s * 0.28 + (s * 0.55 * Math.sin(t) * Math.cos(t)) / d,
          0.4 * Math.sin(t),
        ]);
      }
      addM(kit, 'm', wire(pts, 0.8, { closed: true, radial: 8, seg: 120 }));
      const pv = [];
      for (let i = 2; i < n / 2 - 2; i += 2) pv.push({ p: [pts[i][0], pts[i][1], pts[i][2] + 0.75], up: [0, 0, 1] });
      pave(kit, pv, 1.25, q, { role: '@accent', slot: 'm' });
      bottom = -s * 0.6;
      break;
    }
    default: {
      const m = motif(kit, b.pendant || 'petal', s, { gem: '@main', accent: b.accent || null, cut: b.cut }, q);
      bottom = m.bottom;
      if (b.pendantDrops) {
        const n = b.pendantDrops;
        for (let i = 0; i < n; i++) {
          const x = (i - (n - 1) / 2) * (s * 0.22);
          pearlDrop(kit, x, bottom + 0.5 + Math.abs(x) * 0.25, 0, 1.4, {});
        }
        bottom -= 5;
      }
    }
  }
  kit.pop();
  return { bottom: bottom - 3.4 };
}
/** Places `fn` (building in a local frame facing +z, hanging -y) on the necklace path at fraction s. */
function onPath(kit, path, s, fn, o) {
  o = o || {};
  const f = path.frame(s);
  const X = f.t.clone().normalize(),
    Z = f.n.clone().normalize();
  if (o.flip) X.negate();
  // y: up along the body (opposite to "down"), keep orthonormal
  const Y = new V3().crossVectors(Z, X).normalize();
  if (Y.dot(f.down) > 0) {
    X.negate();
    Y.negate();
  }
  const m = new THREE.Matrix4().makeBasis(X, Y, Z).setPosition(f.p.clone().addScaledVector(Z, o.lift || 0));
  kit.push(m);
  const r = fn();
  kit.pop();
  return r;
}
function lengthMM(cfg, b) {
  return (cfg.lengthIn || b.lengthIn || 18) * 25.4;
}
export function buildNecklace(b, cfg, q) {
  const kit = new Kit();
  const L = lengthMM(cfg, b);
  switch (b.style) {
    case 'chain': {
      const path = necklacePath(L, { k: 1.9 });
      chainAlong(kit, 'm', path.curve, 0, 1, b.link || 2.4, q, { tube: b.chain === 'rope' });
      if (b.pendant) onPath(kit, path, 0, () => pendant(kit, b, q), { lift: 0.8 });
      kit.path = path;
      break;
    }
    case 'strand': {
      // pearls (or gold beads) along the path, graduated towards the front
      const path = necklacePath(L, { k: 1.8, off: (b.pearlR || 3.5) + 0.5 });
      const r0 = b.pearlR || 3.5;
      let u = 0;
      const total = path.length;
      const pts = [];
      while (u < total) {
        const s = u / total;
        const front = Math.pow((1 + Math.cos(s * TAU)) / 2, 2);
        const r = r0 * (b.graduate ? 0.7 + 0.3 * front : 1);
        pts.push([s, r]);
        u += r * 2 + 0.35;
      }
      // leave room at the back for the clasp
      const clasp = 5.5 / total;
      for (const [s, r] of pts) {
        if (b.beads !== 'gold' && Math.abs(s - 0.5) < clasp + r / total) continue;
        const p = path.at(s);
        if (b.beads === 'gold') kit.metalGeo('m', bead(r, p.x, p.y, p.z, q > 0.6 ? 2 : 1));
        else kit.pearl('@pearl', r, [p.x, p.y, p.z]);
      }
      if (b.beads !== 'gold')
        // a small barrel clasp in the chosen metal at the back of the neck
        onPath(kit, path, 0.5, () => {
          const g = new THREE.CylinderGeometry(r0 * 0.62, r0 * 0.62, 9, detail(q, 10, 20));
          g.rotateZ(Math.PI / 2);
          kit.metalGeo('m', g);
          for (const sx of [-1, 1]) {
            const c = torus(r0 * 0.66, 0.35, 6, detail(q, 12, 24));
            c.rotateY(Math.PI / 2);
            c.translate(sx * 2.8, 0, 0);
            kit.metalGeo('m', c);
          }
        });
      if (b.pendant) onPath(kit, path, 0, () => pendant(kit, b, q), { lift: 1 });
      kit.path = path;
      break;
    }
    case 'motifs':
    case 'choker':
    case 'riviera': {
      const choker = b.style === 'choker';
      const path = necklacePath(L, choker ? { k: 1.1, y0: 22, off: 3 } : { k: 1.8, off: 2.2 });
      kit.path = path;
      const span = b.span || (choker ? 0.36 : 0.3); // fraction of the length covered by motifs, centred on the front
      const n = b.count || 15;
      const size0 = b.motifMM || 14;
      // back: chain or silk cord (dori)
      if (b.back === 'dori') {
        const pts = [];
        const m = 60;
        for (let i = 0; i <= m; i++) {
          const p = path.at(span / 2 + ((1 - span) * i) / m);
          pts.push([p.x, p.y, p.z]);
        }
        kit.enamelGeo('red', wire(pts, 0.9, { radial: 6, seg: 120, caps: false }));
      } else chainAlong(kit, 'm', path.curve, span / 2, 1 - span / 2, b.link || 2.2, q);
      for (let i = 0; i < n; i++) {
        const t = n === 1 ? 0 : (i / (n - 1)) * 2 - 1; // -1..1
        const s = (t * span) / 2;
        const grad = b.graduate === false ? 1 : 0.7 + 0.3 * (1 - t * t);
        const sz = size0 * grad;
        const isCentre = i === (n - 1) / 2 && b.centre;
        onPath(
          kit,
          path,
          s,
          () => {
            if (b.style === 'riviera') {
              const r = motif(
                kit,
                'collet',
                sz * 0.5,
                { gem: '@main', cut: isCentre ? b.centreCut || 'pear' : 'round' },
                q,
              );
              if (isCentre && b.centreDrop) pearlDrop(kit, 0, r.bottom, 0.2, 2.6, { pearl: '@pearl' });
              return r;
            }
            const type = isCentre ? b.centre : b.motif;
            const r = motif(
              kit,
              type,
              isCentre ? b.centreMM || sz * 1.8 : sz,
              { gem: '@main', accent: b.accent || null, cut: b.cut },
              q,
            );
            if (b.drops && (q > 0.3 || i % 2 === 0)) {
              const pr = (b.dropR || 1.6) * (isCentre ? 1.4 : 1);
              if (b.drops === 'pearl') pearlDrop(kit, 0, r.bottom + 0.4, 0.2, pr, {});
              else if (b.drops === 'gem') pearlDrop(kit, 0, r.bottom + 0.4, 0.2, pr, { gem: '@drop' });
              else if (b.drops === 'bead') pearlDrop(kit, 0, r.bottom + 0.4, 0.2, pr, { bead: '@accent' });
            }
            if (isCentre && b.centreDrops) {
              const k = b.centreDrops;
              for (let j = 0; j < k; j++) {
                const x = (j - (k - 1) / 2) * 3.2;
                pearlDrop(kit, x, r.bottom + 1.2 + Math.abs(x) * 0.15, 0.2, 1.7, {
                  gem: Math.abs(x) < 1 ? '@drop' : null,
                });
              }
            }
            // joins to the next motif
            if (choker && q > 0.3) jumpRing(kit, 'm', 0.6, sz * 0.48, -0.3, -0.2, Math.PI / 2);
            return r;
          },
          { lift: 0.6 },
        );
      }
      // second row for chokers: small drops between motifs
      if (choker && b.row2) {
        for (let i = 0; i < n - 1; i++) {
          const t = ((i + 0.5) / (n - 1)) * 2 - 1;
          onPath(kit, path, (t * span) / 2, () => motif(kit, b.row2, size0 * 0.55, { gem: '@accent' }, q), {
            lift: 0.4,
          });
        }
      }
      break;
    }
    case 'layered': {
      // rani haar: strands of pearls or beads, a spacer and a large pendant on the longest strand
      const strands = b.strands || 3;
      let last = null;
      for (let k = 0; k < strands; k++) {
        const path = necklacePath(L + k * (b.step || 45), { k: 1.9, off: 2.5 + k * 0.8 });
        const r = (b.pearlR || 2.2) * (1 - k * 0.05);
        const total = path.length;
        for (let u = 0; u < total; u += r * 2 + 0.3) {
          const s = u / total;
          if (k === strands - 1 && Math.abs(((s + 0.5) % 1) - 0.5) < 0.035) continue; // room for the pendant
          const p = path.at(s);
          if (b.beads === 'gold' && k % 2 === 1) kit.metalGeo('m', bead(r * 0.95, p.x, p.y, p.z, q > 0.6 ? 2 : 0));
          else if (b.beads === 'emerald' && k % 2 === 1)
            kit.gem('emerald', 'cabochon', r * 1.9, [p.x, p.y, p.z], [p.x, 0, p.z]);
          else kit.pearl('@pearl', r, [p.x, p.y, p.z]);
        }
        last = path;
        if (k === 0) kit.path = path;
      }
      onPath(
        kit,
        last,
        0,
        () => {
          const r = motif(kit, b.centre || 'polki-oval', b.centreMM || 34, { gem: '@main', accent: '@accent' }, q);
          if (b.centreDrops) {
            for (let j = 0; j < b.centreDrops; j++) {
              const x = (j - (b.centreDrops - 1) / 2) * 3.6;
              pearlDrop(kit, x, r.bottom + 1.5 + Math.abs(x) * 0.1, 0.2, 1.9, { gem: j % 2 ? null : '@drop' });
            }
          }
          return r;
        },
        { lift: 1.2 },
      );
      // side medallions where the strands meet
      for (const sd of [-1, 1])
        onPath(kit, kit.path, sd * 0.2, () => motif(kit, 'petal', 12, { gem: '@main', petals: 6 }, q), { lift: 3 });
      break;
    }
    default:
      return buildNecklace(Object.assign({}, b, { style: 'chain' }), cfg, q);
  }
  return kit;
}

/* ---------------------------------------------------------------- bangles and bracelets */
export function buildBangle(b, cfg, q) {
  const kit = new Kit();
  const Rin = (cfg.bangleDia || 57.2) / 2;
  const count = b.count || 1;
  const th = b.thick || 2.6,
    wd = b.width || 4;
  for (let c = 0; c < count; c++) {
    const z0 = (c - (count - 1) / 2) * (wd + (b.gapMM || 1.2));
    kit.push(T(0, 0, z0));
    const nu = detail(q, 72, 180);
    const Rc = Rin + th / 2;
    switch (b.style) {
      case 'twist': {
        for (let k = 0; k < (b.wires || 3); k++) {
          const g = sweep(
            helixPath(Rc, wd * 0.24, b.turns || 36, (k / (b.wires || 3)) * TAU),
            profileRound(wd * 0.22, 8),
            { nu: detail(q, 220, 520), closed: true },
          );
          kit.metalGeo('m', g);
        }
        break;
      }
      case 'channel': {
        kit.metalGeo('m', sweep(circleP(Rc), profileFlat(th, wd, 16, 6), { nu, closed: true }));
        const s = b.stoneMM || 2.2;
        const Rs = Rin + th + 0.02;
        const span = b.span || TAU;
        const n = Math.floor((span * Rs) / (s + 0.22));
        const pts = [];
        for (let i = 0; i < n; i++) {
          const a = (span < TAU ? -span / 2 : 0) + ((i + 0.5) / n) * span;
          pts.push({
            p: [Rs * Math.sin(a), Rs * Math.cos(a), 0],
            up: [Math.sin(a), Math.cos(a), 0],
            x: [Math.cos(a), -Math.sin(a), 0],
          });
        }
        pave(kit, pts, s, q, { role: '@main', slot: 'w', beads: q > 0.7 });
        // channel walls
        for (const z of [-wd * 0.38, wd * 0.38]) {
          const g = sweep(circleP(Rin + th + 0.25), profileFlat(0.6, 0.45, 8, 4), { nu, closed: true });
          g.translate(0, 0, z);
          kit.metalGeo('m', g);
        }
        break;
      }
      case 'kada':
      case 'temple-kada': {
        kit.metalGeo(
          'm',
          sweep(circleP(Rc), profileRidged(th, wd, b.ridges || 5, 0.22, detail(q, 28, 48)), { nu, closed: true }),
        );
        if (b.style === 'temple-kada' && q > 0.25) {
          const n = b.stones || 16;
          for (let i = 0; i < n; i++) {
            const a = (i / n) * TAU;
            const p = [(Rin + th + 0.2) * Math.sin(a), (Rin + th + 0.2) * Math.cos(a), 0];
            kit.gem('@main', 'cabochon', wd * 0.42, p, [Math.sin(a), Math.cos(a), 0], [Math.cos(a), -Math.sin(a), 0]);
            if (q > 0.45) {
              kit.push(frameMatrix(p, [Math.sin(a), Math.cos(a), 0], [Math.cos(a), -Math.sin(a), 0]));
              bezel(kit, 'm', 'round', wd * 0.42, { t: 0.35, h: 0.8, q });
              kit.pop();
            }
          }
          if (q > 0.5)
            for (const z of [-wd * 0.48, wd * 0.48]) {
              const m = Math.floor((TAU * (Rin + th * 0.6)) / 0.9);
              for (let i = 0; i < m; i++) {
                const a = (i / m) * TAU;
                kit.metalGeo('m', bead(0.38, (Rin + th * 0.62) * Math.sin(a), (Rin + th * 0.62) * Math.cos(a), z, 0));
              }
            }
        }
        break;
      }
      case 'polki': {
        kit.metalGeo('m', sweep(circleP(Rc), profileD(th, wd, 16), { nu, closed: true }));
        const n = b.stones || 14;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * TAU;
          const p = [(Rin + th + 0.3) * Math.sin(a), (Rin + th + 0.3) * Math.cos(a), 0];
          kit.push(frameMatrix(p, [Math.sin(a), Math.cos(a), 0], [Math.cos(a), -Math.sin(a), 0]));
          kit.push(R(-Math.PI / 2, 0, 0));
          const pl = plate(polarOutline(flowerR(wd * 0.62, 8, 0.25, 0.6), detail(q, 24, 48)), 0.8, 0.3);
          kit.metalGeo('m', pl);
          kit.gem('@main', i % 2 ? 'polki-b' : 'polki', wd * 0.8, [0, 0, 0.7], [0, 0, 1]);
          if (b.accent && q > 0.4)
            for (const sd of [-1, 1]) kit.gem(b.accent, 'cabochon', wd * 0.26, [sd * wd * 0.92, 0, 0.5], [0, 0, 1]);
          kit.pop();
          kit.pop();
        }
        break;
      }
      case 'mens': {
        // heavy kada with a faceted (hexagonal) profile
        const hex = [];
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * TAU + Math.PI / 6;
          hex.push([(th / 2) * Math.cos(a) * 1.15, (wd / 2) * Math.sin(a) * 1.15]);
        }
        kit.metalGeo('m', sweep(circleP(Rc), hex, { nu: detail(q, 48, 96), closed: true }));
        break;
      }
      default:
        kit.metalGeo('m', sweep(circleP(Rc), profileD(th, wd, detail(q, 12, 20)), { nu, closed: true }));
    }
    kit.pop();
  }
  kit.anchors.innerR = Rin;
  return kit;
}
function circleP(Rr) {
  return (u) => {
    const a = u * TAU,
      s = Math.sin(a),
      c = Math.cos(a);
    return { p: [Rr * s, Rr * c, 0], t: [c, -s, 0], n: [s, c, 0] };
  };
}
export function buildBracelet(b, cfg, q) {
  const kit = new Kit();
  const rx = (cfg.wristMM || 170) / (2 * Math.PI) + 3.2,
    ry = rx * 0.82;
  const path = ellipsePath(rx, ry);
  if (b.style === 'tennis') {
    const s = b.stoneMM || 2.8;
    let per = 0;
    for (let i = 0; i < 360; i++) {
      const a = path(i / 360).p,
        c = path((i + 1) / 360).p;
      per += Math.hypot(c[0] - a[0], c[1] - a[1]);
    }
    const n = Math.floor(per / (s + 0.55));
    for (let i = 0; i < n; i++) {
      const f = path(i / n);
      const nl = Math.hypot(f.n[0], f.n[1]);
      const up = [f.n[0] / nl, f.n[1] / nl, 0];
      const p = [f.p[0] + up[0] * 1.2, f.p[1] + up[1] * 1.2, 0];
      kit.gem('@main', 'round', s, p, up, [f.t[0], f.t[1], 0]);
      kit.push(frameMatrix(p, up, [f.t[0], f.t[1], 0]));
      // basket: a square box under the stone with four claws
      const bx = new THREE.BoxGeometry(s * 1.02, s * 0.55, s * 0.9);
      bx.translate(0, -s * 0.42, 0);
      kit.metalGeo('w', bx);
      if (q > 0.5)
        for (const [a, c] of [
          [1, 1],
          [-1, 1],
          [1, -1],
          [-1, -1],
        ])
          kit.metalGeo('w', bead(s * 0.12, a * s * 0.42, s * 0.12, c * s * 0.36, 0));
      kit.pop();
    }
    // clasp box at the bottom
    const cl = new THREE.BoxGeometry(5, 3, 3.2);
    cl.translate(0, -ry - 1.2, 0);
    kit.metalGeo('m', cl);
  } else if (b.style === 'curb') {
    // men's bracelet: flat curb links
    const link = b.link || 7;
    const m = new THREE.Matrix4();
    let per = 0;
    for (let i = 0; i < 360; i++) {
      const a = path(i / 360).p,
        c = path((i + 1) / 360).p;
      per += Math.hypot(c[0] - a[0], c[1] - a[1]);
    }
    const n = Math.floor(per / (link * 0.7));
    const base = torus(1, 0.3, 6, detail(q, 10, 16));
    base.scale(link * 0.5, link * 0.33, link * 0.5);
    for (let i = 0; i < n; i++) {
      const f = path((i + 0.5) / n);
      const X = new V3(f.t[0], f.t[1], 0).normalize();
      const Z = new V3(0, 0, 1);
      const Y = new V3().crossVectors(Z, X);
      const g = base.clone().rotateY(i % 2 ? 0.35 : -0.35);
      m.makeBasis(X, Y, Z).setPosition(f.p[0], f.p[1], 0);
      g.applyMatrix4(m);
      kit.metalGeo('m', g);
    }
  }
  kit.anchors.rx = rx;
  return kit;
}

/* ---------------------------------------------------------------- maang tikka and nath */
export function buildTikka(b, cfg, q) {
  const kit = new Kit();
  // hook loop at the top, chain down, pendant at the end
  const hook = torus(2.0, 0.45, 6, 16, Math.PI * 1.6);
  hook.rotateZ(Math.PI * 0.7);
  hook.translate(0, 1.6, -0.5);
  kit.metalGeo('m', hook);
  const Lc = b.chainMM || 50;
  const pts = [];
  for (let i = 0; i <= 20; i++) pts.push(new V3(0, -i * (Lc / 20), Math.sin((i / 20) * Math.PI) * 1.2));
  const curve = new THREE.CatmullRomCurve3(pts);
  chainAlong(kit, 'm', curve, 0, 1, b.link || 1.9, q);
  if (b.bindi) {
    kit.push(T(0, -Lc * 0.35, 0.6));
    motif(kit, 'collet', 3, { gem: '@accent' }, q);
    kit.pop();
  }
  kit.push(T(0, -Lc - 0.5, 0.3));
  const r = motif(kit, b.motif || 'polki-oval', b.motifMM || 22, { gem: '@main', accent: '@accent', petals: 8 }, q);
  if (b.drops) {
    const n = b.drops;
    for (let i = 0; i < n; i++) {
      const x = (i - (n - 1) / 2) * 3;
      pearlDrop(kit, x, r.bottom + 1.6 + Math.abs(x) * 0.2, 0.2, 1.5, { gem: i === (n - 1) / 2 ? '@drop' : null });
    }
  }
  kit.pop();
  kit.anchors.length = Lc + (b.motifMM || 22) + 8;
  kit.anchors.chain = Lc;
  return kit;
}
export function buildNath(b, cfg, q) {
  const kit = new Kit();
  const Rn = b.size || 15;
  // hoop through the piercing at the origin; the ring hangs below and to the side
  const g = sweep(
    (u) => {
      const a = Math.PI / 2 + 0.12 + u * (TAU - 0.24);
      return {
        p: [Rn * Math.cos(a), -Rn + Rn * Math.sin(a), 0],
        t: [-Math.sin(a), Math.cos(a), 0],
        n: [Math.cos(a), Math.sin(a), 0],
      };
    },
    profileRound(b.wire || 0.55, 8),
    { nu: detail(q, 48, 120) },
  );
  kit.metalGeo('m', g);
  // decoration on the lower outer arc: pearls, a red bead and a small kundan flower
  const deco = b.deco || 'bridal';
  const at = (a, off) => [Rn * Math.cos(a) * (1 + (off || 0)), -Rn + Rn * Math.sin(a) * (1 + (off || 0))];
  const beads = deco === 'bridal' ? [-0.15, -0.35, -0.55, -0.75, -0.95] : [-0.5, -0.7];
  beads.forEach((a0, i) => {
    const a = Math.PI + a0 * Math.PI * 0.5;
    const [x, y] = at(a);
    if (i === 2 && deco === 'bridal') kit.gem('@accent', 'cabochon', 2.4, [x, y, 0.6], [0, 0, 1]);
    else kit.pearl('@pearl', 1.15, [x, y, 0]);
  });
  if (deco === 'bridal') {
    const [x, y] = at(Math.PI * 1.25, 0.05);
    kit.push(T(x, y + 4, 0.8));
    motif(kit, 'petal', 8, { gem: '@main', cut: 'polki', petals: 6 }, q);
    kit.pop();
    const [x2, y2] = at(Math.PI * 1.5);
    pearlDrop(kit, x2, y2 - 0.4, 0, 1.3, {});
  }
  kit.anchors.size = Rn;
  return kit;
}

/* ---------------------------------------------------------------- entry point */
/**
 * Builds a product's kit. spec: the product's `build`; cfg: { ringDia, bangleDia, lengthIn, wristMM, stoneMM };
 * q: detail (0..1).
 */
export function buildPiece(spec, cfg, q) {
  cfg = cfg || {};
  const b = Object.assign({}, spec);
  if (cfg.stoneMM) b.stoneMM = cfg.stoneMM;
  switch (spec.type) {
    case 'ring':
      return buildRing(b, cfg, q);
    case 'earrings':
      return buildEarrings(b, cfg, q);
    case 'necklace':
    case 'pendant':
      return buildNecklace(b, cfg, q);
    case 'bangle':
      return buildBangle(b, cfg, q);
    case 'bracelet':
      return buildBracelet(b, cfg, q);
    case 'tikka':
      return buildTikka(b, cfg, q);
    case 'nath':
      return buildNath(b, cfg, q);
    default:
      throw new Error('Unknown jewellery type ' + spec.type);
  }
}
export { S };
