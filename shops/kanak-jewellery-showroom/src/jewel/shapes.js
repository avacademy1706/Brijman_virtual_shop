// Geometry primitives for jewellery, in millimetres: swept bands, wires, lathes, beads, extruded motifs, and the
// body surfaces (neck and chest of a display bust) that necklaces drape over.
import * as THREE from 'three';

const V3 = THREE.Vector3;
const TAU = Math.PI * 2;

/* ---------------------------------------------------------------- sweeps */
/**
 * Sweeps a closed 2D profile along a path.
 * path(u) -> { p: [x,y,z], t: [x,y,z] tangent, n: [x,y,z] reference normal, s: [sa, sb] profile scale }
 * profile: [[a, b], ...] closed loop; a runs along the normal, b along the binormal (t x n).
 */
export function sweep(path, profile, o) {
  o = o || {};
  const nu = o.nu || 64,
    closed = !!o.closed,
    np = profile.length;
  const rows = closed ? nu : nu + 1;
  const pos = new Float32Array(rows * np * 3);
  const tN = new V3(),
    tT = new V3(),
    tB = new V3();
  const centres = [];
  for (let i = 0; i < rows; i++) {
    const f = path(i / nu);
    tT.set(f.t[0], f.t[1], f.t[2]).normalize();
    tN.set(f.n[0], f.n[1], f.n[2]);
    tN.addScaledVector(tT, -tN.dot(tT)).normalize();
    tB.crossVectors(tT, tN).normalize();
    const sa = f.s ? f.s[0] : 1,
      sb = f.s ? f.s[1] : 1;
    centres.push(f.p);
    for (let j = 0; j < np; j++) {
      const a = profile[j][0] * sa,
        b = profile[j][1] * sb,
        k = (i * np + j) * 3;
      pos[k] = f.p[0] + tN.x * a + tB.x * b;
      pos[k + 1] = f.p[1] + tN.y * a + tB.y * b;
      pos[k + 2] = f.p[2] + tN.z * a + tB.z * b;
    }
  }
  const idx = [];
  for (let i = 0; i < nu; i++) {
    const i1 = closed ? (i + 1) % rows : i + 1;
    for (let j = 0; j < np; j++) {
      const j1 = (j + 1) % np;
      const a = i * np + j,
        b = i1 * np + j,
        c = i1 * np + j1,
        d = i * np + j1;
      idx.push(a, b, c, a, c, d);
    }
  }
  let verts = pos;
  if (!closed && o.caps !== false) {
    // fan caps at both ends
    const ext = new Float32Array(pos.length + 6);
    ext.set(pos);
    const c0 = centres[0],
      c1 = centres[rows - 1];
    ext.set(c0, pos.length);
    ext.set(c1, pos.length + 3);
    const ci0 = rows * np,
      ci1 = rows * np + 1;
    for (let j = 0; j < np; j++) {
      const j1 = (j + 1) % np;
      idx.push(ci0, j1, j);
      idx.push(ci1, (rows - 1) * np + j, (rows - 1) * np + j1);
    }
    verts = ext;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(verts, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  orientOutward(g, centres);
  return g;
}
/** Flips the winding if normals point into the sweep. */
function orientOutward(g, centres) {
  const p = g.attributes.position.array,
    n = g.attributes.normal.array;
  let s = 0;
  const step = Math.max(1, Math.floor(p.length / 3 / 60));
  for (let i = 0; i < p.length / 3; i += step) {
    // nearest path centre
    let best = 0,
      bd = Infinity;
    for (let c = 0; c < centres.length; c += Math.max(1, Math.floor(centres.length / 24))) {
      const d =
        (p[i * 3] - centres[c][0]) ** 2 + (p[i * 3 + 1] - centres[c][1]) ** 2 + (p[i * 3 + 2] - centres[c][2]) ** 2;
      if (d < bd) {
        bd = d;
        best = c;
      }
    }
    const cc = centres[best];
    s += (p[i * 3] - cc[0]) * n[i * 3] + (p[i * 3 + 1] - cc[1]) * n[i * 3 + 1] + (p[i * 3 + 2] - cc[2]) * n[i * 3 + 2];
  }
  if (s < 0) {
    const ix = g.index.array;
    for (let i = 0; i < ix.length; i += 3) {
      const t = ix[i + 1];
      ix[i + 1] = ix[i + 2];
      ix[i + 2] = t;
    }
    g.index.needsUpdate = true;
    g.computeVertexNormals();
  }
}

/* ---------------------------------------------------------------- profiles (closed loops, counter-clockwise) */
/** Comfort-fit band: rounded outside, flatter inside. a = radial, b = across the band. */
export function profileD(thick, width, n) {
  n = n || 16;
  const pts = [];
  for (let k = 0; k < n; k++) {
    const t = (k / n) * TAU;
    const c = Math.cos(t),
      s = Math.sin(t);
    const e = c > 0 ? 2.2 : 5; // outside round, inside nearly flat
    const a = (thick / 2) * Math.sign(c) * Math.pow(Math.abs(c), 2 / e);
    const b = (width / 2) * Math.sign(s) * Math.pow(Math.abs(s), 2 / (c > 0 ? 2.6 : 6));
    pts.push([a, b]);
  }
  return pts;
}
export function profileRound(r, n) {
  n = n || 10;
  const pts = [];
  for (let k = 0; k < n; k++) pts.push([r * Math.cos((k / n) * TAU), r * Math.sin((k / n) * TAU)]);
  return pts;
}
export function profileFlat(thick, width, n, e) {
  n = n || 16;
  e = e || 8;
  const pts = [];
  for (let k = 0; k < n; k++) {
    const t = (k / n) * TAU,
      c = Math.cos(t),
      s = Math.sin(t);
    pts.push([
      (thick / 2) * Math.sign(c) * Math.pow(Math.abs(c), 2 / e),
      (width / 2) * Math.sign(s) * Math.pow(Math.abs(s), 2 / e),
    ]);
  }
  return pts;
}
/** Knife-edge band: a ridge on the outside. */
export function profileKnife(thick, width, n) {
  n = n || 14;
  const pts = [];
  for (let k = 0; k < n; k++) {
    const t = (k / n) * TAU,
      c = Math.cos(t),
      s = Math.sin(t);
    const a =
      c > 0 ? (thick / 2) * c * (1 - 0.5 * Math.abs(s)) * 1.3 : (thick / 2) * Math.sign(c) * Math.pow(Math.abs(c), 0.4);
    pts.push([a, (width / 2) * Math.sign(s) * Math.pow(Math.abs(s), 0.6)]);
  }
  return pts;
}
/** Profile with ridges across the band (engraved kada). ridges: count across the width. */
export function profileRidged(thick, width, ridges, depth, n) {
  n = n || 40;
  const base = profileD(thick, width, n);
  return base.map(([a, b]) => {
    if (a <= 0) return [a, b];
    const u = b / (width / 2); // -1..1
    const rr = 1 - depth * (0.5 + 0.5 * Math.cos(u * Math.PI * ridges)) * (1 - u * u * 0.3);
    return [a * rr, b];
  });
}

/* ---------------------------------------------------------------- circular paths */
/** Circle in the XY plane (axis z), angle 0 at +y (where a ring's head sits), radius R. */
export function circlePath(Rr, scaleFn) {
  return (u) => {
    const a = u * TAU,
      s = Math.sin(a),
      c = Math.cos(a);
    return { p: [Rr * s, Rr * c, 0], t: [c, -s, 0], n: [s, c, 0], s: scaleFn ? scaleFn(a) : null };
  };
}
/** Ellipse path in XY plane (bracelets). */
export function ellipsePath(rx, ry) {
  return (u) => {
    const a = u * TAU,
      s = Math.sin(a),
      c = Math.cos(a);
    const p = [rx * s, ry * c, 0];
    const t = [rx * c, -ry * s, 0];
    const n = [s / rx, c / ry, 0];
    return { p, t, n };
  };
}
/** Helix around a circle (twisted wire bangles). */
export function helixPath(Rr, rr, turns, phase) {
  return (u) => {
    const a = u * TAU,
      w = a * turns + (phase || 0);
    const rad = Rr + rr * Math.cos(w),
      z = rr * Math.sin(w);
    const s = Math.sin(a),
      c = Math.cos(a);
    const p = [rad * s, rad * c, z];
    // numeric tangent
    const e = 1e-4,
      a2 = a + e,
      w2 = a2 * turns + (phase || 0),
      r2 = Rr + rr * Math.cos(w2);
    const p2 = [r2 * Math.sin(a2), r2 * Math.cos(a2), rr * Math.sin(w2)];
    return { p, t: [p2[0] - p[0], p2[1] - p[1], p2[2] - p[2]], n: [s, c, 0] };
  };
}

/* ---------------------------------------------------------------- wires, beads, lathes */
/** Round wire through points (CatmullRom). */
export function wire(points, r, o) {
  o = o || {};
  const curve = new THREE.CatmullRomCurve3(
    points.map((p) => new V3(p[0], p[1], p[2])),
    !!o.closed,
    'centripetal',
  );
  const g = new THREE.TubeGeometry(curve, o.seg || Math.max(6, points.length * 6), r, o.radial || 8, !!o.closed);
  if (!o.closed && o.caps !== false) return capTube(g, curve, r);
  return g;
}
function capTube(g, curve, r) {
  const a = new THREE.SphereGeometry(r, 8, 6),
    b = new THREE.SphereGeometry(r, 8, 6);
  const p0 = curve.getPoint(0),
    p1 = curve.getPoint(1);
  a.translate(p0.x, p0.y, p0.z);
  b.translate(p1.x, p1.y, p1.z);
  return [g, a, b];
}
export function bead(r, x, y, z, detail) {
  const g = new THREE.IcosahedronGeometry(r, detail == null ? 1 : detail);
  g.translate(x, y, z);
  return g;
}
export function torus(R, r, radial, tubular, arc) {
  return new THREE.TorusGeometry(R, r, radial || 8, tubular || 32, arc || TAU);
}
export function lathe(profile, segs) {
  return new THREE.LatheGeometry(
    profile.map((p) => new THREE.Vector2(Math.max(0, p[0]), p[1])),
    segs || 32,
  );
}
/** Extrudes a 2D outline (array of [x, y]) into a plate of depth d, bevelled, facing +z, centred on z = 0. */
export function plate(outline, d, bevel, o) {
  o = o || {};
  const sh = new THREE.Shape(outline.map((p) => new THREE.Vector2(p[0], p[1])));
  if (o.holes) for (const h of o.holes) sh.holes.push(new THREE.Path(h.map((p) => new THREE.Vector2(p[0], p[1]))));
  const g = new THREE.ExtrudeGeometry(sh, {
    depth: d,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel * 0.9,
    bevelSegments: o.bevelSegments || 2,
    curveSegments: 6,
  });
  g.translate(0, 0, -d / 2);
  if (o.bulge !== 0) bulge(g, outline, o.bulge == null ? 0.35 : o.bulge, d);
  return g;
}
/** Domes the front face of a plate a little (gold work is never perfectly flat; the curve catches the light). */
function bulge(g, outline, k, d) {
  let cx = 0,
    cy = 0,
    R = 0;
  for (const p of outline) {
    cx += p[0] / outline.length;
    cy += p[1] / outline.length;
  }
  for (const p of outline) R = Math.max(R, Math.hypot(p[0] - cx, p[1] - cy));
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const z = pos.getZ(i);
    if (z <= d * 0.1) continue;
    const r = Math.hypot(pos.getX(i) - cx, pos.getY(i) - cy) / R;
    pos.setZ(i, z + k * R * 0.3 * Math.max(0, 1 - r * r));
  }
  g.computeVertexNormals();
}
/** Polar outline r(theta) -> points, for flowers, coins and medallions. */
export function polarOutline(rFn, n, ox, oy) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * TAU;
    const r = rFn(t);
    pts.push([(ox || 0) + r * Math.cos(t), (oy || 0) + r * Math.sin(t)]);
  }
  return pts;
}
export const flowerR = (r0, petals, depth, sharp) => (t) =>
  r0 * (1 - depth + depth * Math.pow(Math.abs(Math.cos((t * petals) / 2)), sharp || 0.6));
/** Paisley (kairi / mango) outline, tip curling to the right, ~1 unit long. */
export function paisleyOutline(n, s) {
  s = s || 1;
  const pts = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * TAU;
    // teardrop with a curled tip
    const x = 0.5 * Math.sin(t) * (1 - 0.35 * Math.cos(t));
    const y =
      -0.55 * Math.cos(t) * (0.9 + 0.1 * Math.sin(t)) + 0.18 * Math.pow(Math.max(0, Math.cos(t)), 6) * Math.sin(t);
    const curl = 0.22 * Math.pow(Math.max(0, -Math.cos(t)), 5);
    pts.push([(x + curl) * s, y * s]);
  }
  return pts;
}
/** Leaf / lens outline, length 1 along y. */
export function leafOutline(n, w) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * TAU;
    pts.push([(w || 0.32) * Math.sin(t) * Math.pow(Math.abs(Math.sin(t)), 0.1), 0.5 * Math.cos(t)]);
  }
  return pts;
}
/** Crescent outline for chandbalis: outer unit circle minus an inner circle (radius ri, centre raised by sh). */
export function crescentOutline(n, ri, sh) {
  ri = ri || 0.7;
  sh = sh || 0.42;
  const yi = (1 - ri * ri + sh * sh) / (2 * sh),
    xi = Math.sqrt(Math.max(0, 1 - yi * yi));
  const b = Math.atan2(yi, xi),
    g = Math.atan2(yi - sh, xi);
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = Math.PI - b + ((Math.PI + 2 * b) * i) / n;
    pts.push([Math.cos(a), Math.sin(a)]);
  }
  for (let i = 1; i < n; i++) {
    const a = g - ((Math.PI + 2 * g) * i) / n;
    pts.push([ri * Math.cos(a), sh + ri * Math.sin(a)]);
  }
  return pts;
}
/** Points along the crescent's outer (lower) edge, for stones and drops. */
export function crescentEdge(n, ri, sh, inset) {
  ri = ri || 0.7;
  sh = sh || 0.42;
  const yi = (1 - ri * ri + sh * sh) / (2 * sh),
    xi = Math.sqrt(Math.max(0, 1 - yi * yi));
  const b = Math.atan2(yi, xi);
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = Math.PI - b + ((Math.PI + 2 * b) * (i + 0.5)) / n;
    pts.push([(1 - (inset || 0)) * Math.cos(a), (1 - (inset || 0)) * Math.sin(a), a]);
  }
  return pts;
}

/* ---------------------------------------------------------------- the display bust (also the necklace's body) */
// Bust frame: y up, z towards the viewer, neck base at y = 0. Units mm.
export const BUST = {
  top: 78,
  bottom: -190,
  rx(y) {
    if (y >= 6) return 47 - Math.min(5, (y - 6) * 0.06);
    const d = Math.max(0, 6 - y);
    return 47 + 1.75 * d - 0.0042 * d * d;
  },
  rz(y, back) {
    if (y >= 6) return 42 - Math.min(4, (y - 6) * 0.05);
    const d = Math.max(0, 6 - y);
    return back ? 42 + 0.55 * d - 0.0012 * d * d : 42 + 0.5 * d - 0.0009 * d * d;
  },
};
/** Point on the bust surface at height y and angle t (0 = front centre, positive towards +x). */
export function bustPoint(y, t, off) {
  const back = Math.cos(t) < 0;
  const rx = BUST.rx(y),
    rz = BUST.rz(y, back);
  // superellipse: flatter front and back like a real bust
  const c = Math.cos(t),
    s = Math.sin(t),
    e = y < 0 ? 2.6 : 2;
  const x = rx * Math.sign(s) * Math.pow(Math.abs(s), 2 / e),
    z = rz * Math.sign(c) * Math.pow(Math.abs(c), 2 / e);
  // outward normal (numeric)
  const p = new V3(x, y, z);
  if (off) {
    const n = bustNormal(y, t);
    p.addScaledVector(n, off);
  }
  return p;
}
export function bustNormal(y, t) {
  const e = 0.01,
    ey = 0.5;
  const a = bustPoint(y, t - e),
    b = bustPoint(y, t + e),
    c = bustPoint(y - ey, t),
    d = bustPoint(y + ey, t);
  const tu = b.sub(a),
    tv = d.sub(c);
  const n = new V3().crossVectors(tv, tu).normalize();
  // outward: away from the axis
  const p = bustPoint(y, t);
  if (n.x * p.x + n.z * p.z < 0) n.negate();
  return n;
}
/** Bust geometry (velvet form). */
export function bustGeometry(segU, segV) {
  segU = segU || 48;
  segV = segV || 40;
  const ys = [];
  for (let i = 0; i <= segV; i++) {
    const t = i / segV;
    // denser around the neck base where the curvature is
    const y = BUST.top + (BUST.bottom - BUST.top) * (t < 0.45 ? t * 0.85 : 0.3825 + (t - 0.45) * 1.1227);
    ys.push(y);
  }
  const pos = [],
    idx = [];
  for (let i = 0; i <= segV; i++)
    for (let j = 0; j <= segU; j++) {
      const p = bustPoint(ys[i], (j / segU) * TAU);
      pos.push(p.x, p.y, p.z);
    }
  for (let i = 0; i < segV; i++)
    for (let j = 0; j < segU; j++) {
      const a = i * (segU + 1) + j,
        b = a + 1,
        c = a + segU + 1,
        d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  // neck cap
  const cap = new THREE.CircleGeometry(1, segU);
  cap.rotateX(-Math.PI / 2);
  cap.scale(BUST.rx(BUST.top), 1, BUST.rz(BUST.top));
  cap.translate(0, BUST.top, 0);
  return [g, cap];
}

/* ---------------------------------------------------------------- necklace paths */
/**
 * Closed necklace path on the bust with the given length (mm). Returns { pts: Vector3[], at(s), frame(s), drop }.
 * shape: 'u' for chains and long necklaces, 'collar' for chokers (sits high, round).
 */
export function necklacePath(length, o) {
  o = o || {};
  const k = o.k || 1.7,
    off = o.off == null ? 2.2 : o.off,
    y0 = o.y0 == null ? 3 : o.y0;
  const n = 220;
  const build = (drop) => {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const t = (i / n) * TAU;
      const w = Math.pow((1 + Math.cos(t)) / 2, k);
      const y = y0 - drop * w;
      pts.push(bustPoint(y, t, off));
    }
    return pts;
  };
  const len = (pts) => {
    let L = 0;
    for (let i = 0; i < pts.length; i++) L += pts[i].distanceTo(pts[(i + 1) % pts.length]);
    return L;
  };
  let lo = 0,
    hi = 400,
    pts = build(0);
  if (len(pts) < length) {
    for (let it = 0; it < 40; it++) {
      const mid = (lo + hi) / 2;
      pts = build(mid);
      if (len(pts) < length) lo = mid;
      else hi = mid;
    }
  }
  const drop = (lo + hi) / 2;
  pts = build(drop);
  const curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal');
  return {
    curve,
    drop,
    length: curve.getLength(),
    /** Point at fraction s (0 = front centre). */
    at: (s) => curve.getPointAt(((s % 1) + 1) % 1),
    /** Frame at s: tangent, outward normal (off the body), down (along the body, gravity side). */
    frame(s) {
      const u = ((s % 1) + 1) % 1;
      const p = curve.getPointAt(u),
        tg = curve.getTangentAt(u);
      // approximate surface normal at that point
      const t = Math.atan2(p.x, p.z);
      const nn = bustNormal(p.y, t);
      const down = new V3().crossVectors(tg, nn).normalize();
      if (down.y > 0) down.negate();
      return { p, t: tg, n: nn, down };
    },
  };
}
