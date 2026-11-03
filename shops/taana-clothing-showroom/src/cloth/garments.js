// Garment pattern builder. Turns a garment spec (template + size chart in metres) and a body into
// a particle cloth: rest positions in the canonical rest pose, constraints, pins, skin bindings,
// tethers, and a render mesh (indices + UVs + vertex-to-particle map).
// Pure JavaScript (no three.js): used by the browser and by scripts/bake-drapes.mjs.
import { SEG, restPose, frames, toLocal, toWorld, vec, shoulderTop, colliders } from './body.js';
import { CGROUP, resolvePoint } from './sim.js';

const { add, sub, mul, norm, cross, dot, len } = vec;

/** Templates: shape rules that do not depend on size. */
export const TEMPLATES = {
  tee: {
    label: 'T-shirt',
    sleeve: 'short',
    neck: { front: 0.07, back: 0.02, half: 0.075 },
    fitted: 0.6,
    flareFrom: null,
    slit: null,
    open: false,
    cols: 30,
    skin: [0.3, 0.07, 0.03],
  },
  shirt: {
    label: 'Shirt',
    sleeve: 'long',
    neck: { front: 0.06, back: 0.015, half: 0.06 },
    fitted: 0.55,
    flareFrom: null,
    slit: 0.06,
    open: false,
    buttons: 6,
    cols: 30,
    skin: [0.3, 0.08, 0.03],
  },
  kurta: {
    label: 'Kurta',
    sleeve: 'three-quarter',
    neck: { front: 0.1, back: 0.02, half: 0.065 },
    fitted: 0.4,
    flareFrom: null,
    slit: 0.32,
    open: false,
    placket: 0.2,
    buttons: 3,
    cols: 32,
    skin: [0.28, 0.08, 0],
  },
  anarkali: {
    label: 'Anarkali',
    sleeve: 'long',
    neck: { front: 0.1, back: 0.03, half: 0.07 },
    fitted: 0.9,
    flareFrom: 0.62,
    slit: null,
    open: false,
    cols: 44,
    folds: 12,
    skin: [0.45, 0.35, 0],
  },
  dress: {
    label: 'Dress',
    sleeve: 'cap',
    neck: { front: 0.11, back: 0.04, half: 0.08 },
    fitted: 0.8,
    flareFrom: 0.62,
    slit: null,
    open: false,
    cols: 38,
    folds: 9,
    skin: [0.4, 0.3, 0],
  },
  vest: {
    label: 'Nehru jacket',
    sleeve: null,
    neck: { front: 0.03, back: 0.01, half: 0.06 },
    fitted: 0.7,
    flareFrom: null,
    slit: 0.1,
    open: false,
    buttons: 5,
    cols: 30,
    skin: [0.38, 0.2, 0.12],
  },
  dupatta: { label: 'Dupatta', strip: true },
};

// Sleeve length as a function of the arm, so the same template fits adults and children.
const SLEEVES = {
  short: { len: (m) => m.upperArm * 0.7, cuff: 0.98 },
  cap: { len: (m) => m.upperArm * 0.36, cuff: 1.0 },
  'three-quarter': { len: (m) => m.upperArm + m.foreArm * 0.62, cuff: 0.0 },
  long: { len: (m) => m.upperArm + m.foreArm + 0.025, cuff: 0.0 },
};

/** Template merged with per-product overrides (spec.over), neck sizes scaled to the body. */
export function templateFor(spec, m) {
  const base = TEMPLATES[spec.template];
  if (!base) throw new Error('Unknown garment template: ' + spec.template);
  const T = Object.assign({}, base, spec.over || {});
  if (base.neck) {
    const k = m.shoulderW / 0.33;
    const n = Object.assign({}, base.neck, (spec.over && spec.over.neck) || {});
    T.neck = { front: n.front * k, back: n.back * k, half: n.half * k };
  }
  return T;
}

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const lerp = (a, b, t) => a + (b - a) * t;
/** Ellipse half-axes with perimeter P and aspect k = b/a (Ramanujan). */
function ellipseFromPerimeter(P, k) {
  const a = P / (Math.PI * (3 * (1 + k) - Math.sqrt((3 + k) * (1 + 3 * k))));
  return [a, a * k];
}

/**
 * @param {object} spec { template, dims: { chest, waist?, hip?, hem?, length, sleeve? } (metres), seed? }
 * @param {object} m body measurements (see body.js)
 * @param {object} [opts] { res: 1 (resolution scale), armAngle }
 */
export function buildGarment(spec, m, opts = {}) {
  const T = templateFor(spec, m);
  const res = opts.res || 1;
  const J = restPose(m, opts.armAngle);
  const F = frames(J);
  const B = new Builder(F);
  B.res = res;
  if (T.strip) buildDupatta(B, spec, m, J, res);
  else {
    buildBody(B, T, spec, m, J, res);
    if (T.sleeve) {
      buildSleeve(B, T, spec, m, J, 'l', res);
      buildSleeve(B, T, spec, m, J, 'r', res);
    }
  }
  return B.finish(spec);
}

class Builder {
  constructor(F) {
    this.F = F;
    this.rest = [];
    this.seg = [];
    this.seg2 = [];
    this.w2 = [];
    this.pinned = [];
    this.skin = [];
    this.cons = [];
    this.consRest = [];
    this.consType = [];
    this.tAnchor = [];
    this.tMax = [];
    this.cmask = [];
    this.rPos = [];
    this.rUV = [];
    this.rEdge = [];
    this.rMap = [];
    this.index = [];
    this.parts = [];
    this.girth = []; // (v, girth) pairs of the body tube, used for hanger boards
  }
  /** seg2/w2: optional second body segment and its blend weight (two-bone skinning, e.g. the armpit). */
  particle(p, seg, pinned, skin, cmask = CGROUP.ALL, seg2 = -1, w2 = 0) {
    const i = this.rest.length / 3;
    this.rest.push(p[0], p[1], p[2]);
    this.seg.push(seg);
    this.seg2.push(w2 > 0 ? seg2 : -1);
    this.w2.push(w2 > 0 ? w2 : 0);
    this.pinned.push(pinned ? 1 : 0);
    this.skin.push(pinned ? 0 : skin);
    this.cmask.push(cmask);
    this.tAnchor.push(-1);
    this.tMax.push(0);
    return i;
  }
  P(i) {
    return [this.rest[i * 3], this.rest[i * 3 + 1], this.rest[i * 3 + 2]];
  }
  link(a, b, type) {
    this.cons.push(a, b);
    this.consRest.push(len(sub(this.P(a), this.P(b))));
    this.consType.push(type);
  }
  /**
   * Add a grid: rows x cols particle ids (2D array). wrap: columns wrap around.
   * cut(r, c): true if the edge between column c and c+1 is cut at row r.
   */
  grid(ids, wrap, cut, uvOf, outward) {
    const R = ids.length,
      Cn = ids[0].length;
    const nc = (c) => (c + 1) % Cn;
    const lastC = wrap ? Cn : Cn - 1;
    for (let r = 0; r < R; r++) {
      for (let c = 0; c < lastC; c++) if (!cut(r, c)) this.link(ids[r][c], ids[r][nc(c)], 0);
      for (let c = 0; c < Cn; c++) if (r + 1 < R) this.link(ids[r][c], ids[r + 1][c], 0);
    }
    for (let r = 0; r + 1 < R; r++) {
      for (let c = 0; c < lastC; c++) {
        if (cut(r, c) || cut(r + 1, c)) continue;
        this.link(ids[r][c], ids[r + 1][nc(c)], 1);
        this.link(ids[r][nc(c)], ids[r + 1][c], 1);
      }
    }
    for (let r = 0; r < R; r++) {
      for (let c = 0; c < lastC; c++) {
        const c2 = (c + 2) % Cn;
        if (!wrap && c + 2 >= Cn) continue;
        if (cut(r, c) || cut(r, nc(c))) continue;
        this.link(ids[r][c], ids[r][c2], 2);
      }
      for (let c = 0; c < Cn; c++) if (r + 2 < R) this.link(ids[r][c], ids[r + 2][c], 2);
    }
    // render vertices: duplicate the wrap seam and any cut so UVs stay continuous
    const base = this.rPos.length / 3;
    const RC = wrap ? Cn + 1 : Cn;
    const vid = [];
    for (let r = 0; r < R; r++) {
      const row = [];
      for (let c = 0; c < RC; c++) {
        const pid = ids[r][c % Cn];
        const p = this.P(pid);
        this.rPos.push(p[0], p[1], p[2]);
        const uv = uvOf(r, c);
        this.rUV.push(uv[0], uv[1]);
        this.rEdge.push(uv[2] ?? 1); // distance (m) to the decorated edge: hem, cuff, or dupatta border
        this.rMap.push(pid);
        row.push(base + r * RC + c);
      }
      vid.push(row);
    }
    // orientation: compare the first quad normal with the outward hint
    const tri = [];
    for (let r = 0; r + 1 < R; r++) {
      for (let c = 0; c < RC - 1; c++) {
        const ci = c % Cn;
        if (cut(r, ci)) continue;
        tri.push([vid[r][c], vid[r + 1][c], vid[r][c + 1]], [vid[r][c + 1], vid[r + 1][c], vid[r + 1][c + 1]]);
      }
    }
    if (tri.length && outward) {
      const t0 = tri[Math.floor(tri.length / 2)];
      const p0 = this.rp(t0[0]),
        p1 = this.rp(t0[1]),
        p2 = this.rp(t0[2]);
      const nrm = cross(sub(p1, p0), sub(p2, p0));
      const ctr = mul(add(add(p0, p1), p2), 1 / 3);
      if (dot(nrm, outward(ctr)) < 0)
        for (const t of tri) {
          const x = t[1];
          t[1] = t[2];
          t[2] = x;
        }
    }
    for (const t of tri) this.index.push(t[0], t[1], t[2]);
  }
  rp(v) {
    return [this.rPos[v * 3], this.rPos[v * 3 + 1], this.rPos[v * 3 + 2]];
  }
  /**
   * Render-only strip between two particle edges that run side by side (e.g. the front and back halves of a
   * shoulder seam). pairs: [[a, b, u], ...] in order along the seam; a and b may be the same particle at an end.
   * The texture runs straight across from a (v = 0) to b; edge is the distance to the decorated edge.
   */
  bridge(pairs, edge, up) {
    if (pairs.length < 2) return;
    const base = this.rPos.length / 3;
    for (const [a, b, u] of pairs) {
      const pa = this.P(a),
        pb = this.P(b);
      for (const [i, v] of [
        [a, 0],
        [b, len(sub(pb, pa)) / 0.25],
      ]) {
        const p = this.P(i);
        this.rPos.push(p[0], p[1], p[2]);
        this.rUV.push(u, v);
        this.rEdge.push(edge);
        this.rMap.push(i);
      }
    }
    const tri = [];
    for (let k = 0; k + 1 < pairs.length; k++) {
      const a0 = base + k * 2,
        b0 = a0 + 1,
        a1 = a0 + 2,
        b1 = a0 + 3;
      tri.push([a0, a1, b0]);
      if (pairs[k + 1][0] !== pairs[k + 1][1]) tri.push([a1, b1, b0]);
    }
    // face outwards (up)
    const t0 = tri[0];
    const nrm = cross(sub(this.rp(t0[1]), this.rp(t0[0])), sub(this.rp(t0[2]), this.rp(t0[0])));
    const flip = dot(nrm, up) < 0;
    for (const t of tri) this.index.push(t[0], flip ? t[2] : t[1], flip ? t[1] : t[2]);
  }
  tetherColumn(ids, anchorRow = 0, slack = 1.04) {
    const R = ids.length,
      Cn = ids[0].length;
    for (let c = 0; c < Cn; c++) {
      let acc = 0;
      for (let r = anchorRow + 1; r < R; r++) {
        acc += len(sub(this.P(ids[r][c]), this.P(ids[r - 1][c])));
        const i = ids[r][c];
        if (this.pinned[i]) continue;
        this.tAnchor[i] = ids[anchorRow][c];
        this.tMax[i] = acc * slack;
      }
    }
  }
  finish(spec) {
    const n = this.rest.length / 3;
    const local = new Float32Array(n * 3),
      local2 = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const l = toLocal(this.F[this.seg[i]], this.P(i));
      local[i * 3] = l[0];
      local[i * 3 + 1] = l[1];
      local[i * 3 + 2] = l[2];
      if (this.seg2[i] >= 0) {
        const l2 = toLocal(this.F[this.seg2[i]], this.P(i));
        local2[i * 3] = l2[0];
        local2[i * 3 + 1] = l2[1];
        local2[i * 3 + 2] = l2[2];
      }
    }
    return {
      spec,
      rest: Float32Array.from(this.rest),
      cons: Uint32Array.from(this.cons),
      consRest: Float32Array.from(this.consRest),
      consType: Uint8Array.from(this.consType),
      pinned: Uint8Array.from(this.pinned),
      skin: Float32Array.from(this.skin),
      tetherAnchor: Int32Array.from(this.tAnchor),
      tetherMax: Float32Array.from(this.tMax),
      cmask: Uint8Array.from(this.cmask),
      seg: Int8Array.from(this.seg),
      seg2: Int8Array.from(this.seg2),
      w2: Float32Array.from(this.w2),
      local,
      local2,
      trims: this.trims || [],
      girth: Float32Array.from(this.girth),
      render: {
        position: Float32Array.from(this.rPos),
        uv: Float32Array.from(this.rUV),
        edge: Float32Array.from(this.rEdge),
        map: Uint32Array.from(this.rMap),
        index: Uint32Array.from(this.index),
      },
      strip: !!TEMPLATES[spec.template].strip,
      res: this.res || 1,
    };
  }
}

/** Fill `out` (Float32Array, xyz per particle) with body-attached target positions for the given frames. */
export function computeTargets(g, F, out) {
  const { seg, local, seg2, local2, w2 } = g;
  const n = seg.length;
  for (let i = 0; i < n; i++) {
    const f = F[seg[i]];
    const lx = local[i * 3],
      ly = local[i * 3 + 1],
      lz = local[i * 3 + 2];
    let x = f.o[0] + f.x[0] * lx + f.y[0] * ly + f.z[0] * lz;
    let y = f.o[1] + f.x[1] * lx + f.y[1] * ly + f.z[1] * lz;
    let z = f.o[2] + f.x[2] * lx + f.y[2] * ly + f.z[2] * lz;
    const s2 = seg2[i];
    if (s2 >= 0) {
      const h = F[s2],
        w = w2[i];
      const mx = local2[i * 3],
        my = local2[i * 3 + 1],
        mz = local2[i * 3 + 2];
      x += (h.o[0] + h.x[0] * mx + h.y[0] * my + h.z[0] * mz - x) * w;
      y += (h.o[1] + h.x[1] * mx + h.y[1] * my + h.z[1] * mz - y) * w;
      z += (h.o[2] + h.x[2] * mx + h.y[2] * my + h.z[2] * mz - z) * w;
    }
    out[i * 3] = x;
    out[i * 3 + 1] = y;
    out[i * 3 + 2] = z;
  }
  return out;
}

// ---------------------------------------------------------------- body tube
function buildBody(B, T, spec, m, J, res) {
  const d = spec.dims;
  const L = d.length;
  const Gc = d.chest;
  const Gw = d.waist || Gc * lerp(0.98, 0.86, T.fitted);
  const Gh = d.hip || Gc * 1.02;
  const Ghem = d.hem || (T.flareFrom ? Gh * (T.hemF || 2.6) : Gh);
  const cols = Math.max(16, Math.round((T.cols * res) / 2) * 2);
  const dv = 0.036 / res;
  const vWaist = m.torsoLen * 0.62,
    vHip = m.torsoLen * 1.0;
  const flareV = T.flareFrom ? m.torsoLen * T.flareFrom : null;
  // Sleeved garments cover the shoulder cap (the sleeve overlaps it); sleeveless ones end at the shoulder joint.
  const lay = (spec.layer || 0) * 0.012; // outer layers (jackets, vests) sit a little further out
  const a0 = (T.sleeve ? m.shoulderW / 2 + m.upperArmR * 1.35 : m.shoulderW / 2 + 0.008) + lay,
    b0 = m.chestB * 0.82 + lay;
  const vA = 0.17; // depth of the shoulder/armhole region
  const vArmpit = m.torsoLen * 0.36;
  // Above the armpit the body panel sits under the sleeve (or around the armhole): ignore the upper arms there.
  const maskTop = T.sleeve ? CGROUP.ALL & ~CGROUP.UARM : CGROUP.ALL;
  // rest-pose body used to keep the upper rows of the rest shape outside the torso, shoulders and neck
  const restC = colliders(J, m, frames(J), { legs: false });
  const fitMask = CGROUP.TORSO | CGROUP.SHOULDER | CGROUP.HEAD;
  // neckline: opening half-width at the base of the neck, depth of the top edge front and back
  const xn = T.neck.half + 0.008,
    zEdge = 0.012;
  const zFront = m.chestB * 0.8 + lay,
    zBack = m.chestB * 0.72 + lay;
  const smoothSign = (c) => Math.atan(c / 0.12) / Math.atan(1 / 0.12);
  // girth of the tube at depth v (m below the shoulder line)
  const girthAt = (v) => {
    let G;
    if (v <= vWaist) G = lerp(Gc, Gw, smooth(vA, vWaist, v));
    else if (v <= vHip) G = lerp(Gw, Gh, smooth(vWaist, vHip, v));
    else G = lerp(Gh, Ghem, smooth(vHip, L, v));
    if (flareV !== null && v > flareV) G = lerp(Gw, Ghem, Math.pow(smooth(flareV, L, v), 0.8));
    return G;
  };
  // top edge of each column: shoulder seams (thin, sloping with the shoulders) joined by the neckline front and back.
  // Columns are spread along the top edge so that one lands exactly on each corner of the neckline: the shoulder
  // seam then starts right at the neck opening (otherwise, on coarse cloth, a slit up to one column wide is left
  // between the neckline and the first seam column).
  const dth = (Math.PI * 2) / cols;
  const thN = Math.min(Math.floor(cols / 4) - 1, Math.max(1, Math.round(((Math.PI / 2) * (xn / a0)) / dth))) * dth;
  const xAlongTop = (thF) => {
    const t = Math.abs(thF);
    return Math.sign(thF) * (t <= thN ? (xn * t) / thN : xn + ((a0 - xn) * (t - thN)) / (Math.PI / 2 - thN));
  };
  const top = [];
  for (let c = 0; c < cols; c++) {
    const th = Math.PI + c * dth; // column 0 at the back centre (seam hidden)
    const cz = Math.cos(th);
    const thF = Math.atan2(Math.sin(th), Math.abs(cz)); // angle from the centre line, -pi/2..pi/2
    const xTop = xAlongTop(thF);
    const pn = Math.abs(xTop) >= xn - 1e-9 ? 0 : Math.sqrt(1 - (xTop / xn) ** 2);
    const zTop = (zEdge + ((cz > 0 ? zFront : zBack) - zEdge) * Math.pow(pn, 0.7)) * smoothSign(cz);
    const yTop = shoulderTop(m, xTop) + 0.008 + lay * 0.5 - (cz > 0 ? T.neck.front : T.neck.back) * pn;
    top.push({ th, cz, xTop, yTop, zTop, pn });
  }
  // rest positions of one row of the tube at depth v
  const rowPoints = (v) => {
    const G = girthAt(v);
    const k =
      v < vHip ? lerp(0.66, 0.72, smooth(0, vHip, v)) : lerp(0.72, flareV !== null ? 0.92 : 0.78, smooth(vHip, L, v));
    let [ae, be] = ellipseFromPerimeter(G, k);
    ae += lay;
    be += lay;
    // body must fit inside: never smaller than the torso surface plus a little ease
    const sb = smooth(0, vA, v);
    const pts = [];
    for (let c = 0; c < cols; c++) {
      const { th, xTop, yTop, zTop } = top[c];
      let x = ae * Math.sin(th),
        z = be * Math.cos(th);
      // designed folds for flared skirts
      if (flareV !== null && v > flareV && T.folds) {
        const f = 1 + 0.07 * smooth(flareV, L, v) * Math.sin(th * T.folds + (spec.seed || 0));
        x *= f;
        z *= f;
      }
      let p = [lerp(xTop, x, sb), yTop * (1 - sb) - v, lerp(zTop, z, sb)];
      if (v < vA + 0.08) p = resolvePoint(p, restC, 0.008 + lay, fitMask);
      pts.push(p);
    }
    return pts;
  };
  // Row depths. Over the shoulders the tube turns from the thin seam line to the chest within a few centimetres
  // of depth, so equal steps in v leave rows far apart there and the flat triangles between them cut into the
  // shoulder. Rows down to vFine are therefore spaced evenly along the surface (the column that moves furthest
  // sets the spacing); below that the tube is nearly vertical and equal steps in v are fine.
  const vs = [0],
    rowPts = [rowPoints(0)];
  {
    const vFine = Math.min(L, 0.22),
      dsF = 0.024 / res,
      step = 0.004;
    let prev = rowPts[0],
      acc = 0;
    for (let v = step; v < vFine - 0.3 * dsF; v += step) {
      const pts = rowPoints(v);
      let d = 0;
      for (let c = 0; c < cols; c++) d = Math.max(d, len(sub(pts[c], prev[c])));
      acc += d;
      prev = pts;
      if (acc >= dsF) {
        vs.push(v);
        rowPts.push(pts);
        acc = 0;
      }
    }
    const nRest = Math.max(1, Math.round((L - vFine) / dv));
    for (let i = 0; i <= nRest; i++) {
      const v = vFine + ((L - vFine) * i) / nRest;
      vs.push(v);
      rowPts.push(rowPoints(v));
    }
  }
  const rows = vs.length;
  const rowAt = (v) => {
    let best = 0;
    for (let r = 0; r < rows; r++) if (Math.abs(vs[r] - v) < Math.abs(vs[best] - v)) best = r;
    return best;
  };
  const ids = [];
  const pinRows = 1;
  for (let r = 0; r < rows; r++) {
    const v = vs[r];
    B.girth.push(v, Math.min(girthAt(v), Gh * 1.08));
    const row = [];
    for (let c = 0; c < cols; c++) {
      const seg = v < m.torsoLen * 0.98 ? SEG.TORSO : SEG.PELVIS;
      const w = r < pinRows ? 0 : skinAt(T, v, m, L);
      row.push(B.particle(rowPts[r][c], seg, r < pinRows, w, v < vArmpit + 0.03 ? maskTop : CGROUP.ALL));
    }
    ids.push(row);
  }
  // cuts: side slits (columns at the person's left and right sides) and a front opening
  const sideL = Math.round(cols * 0.75) - 1,
    sideR = Math.round(cols * 0.25) - 1,
    frontC = cols / 2 - 1;
  const slitRow = T.slit ? rowAt(L - T.slit) : rows;
  // sleeveless: the side seams are open above the armpit, which makes the armholes
  const armholeRow = T.sleeve ? 0 : rowAt(vArmpit);
  const cut = (r, c) => {
    if (T.open && r >= 1 && c === frontC) return true;
    if (r >= slitRow && (c === sideL || c === sideR)) return true;
    if (r >= 1 && r < armholeRow && (c === sideL || c === sideR)) return true;
    return false;
  };
  const circ = Gc;
  B.grid(
    ids,
    true,
    cut,
    (r, c) => [(c / cols) * (circ / 0.25), -vs[r] / 0.25, L - vs[r]],
    (p) => [p[0], 0, p[2]],
  );
  // Shoulder seams: outside the neckline the front and back top edges are pinned a couple of centimetres apart
  // over each shoulder. Close that slit with a strip of render triangles (both edges are pinned, so the strip
  // never stretches) or the mannequin shows through the seam.
  for (const side of [1, -1]) {
    const pairs = [];
    for (let i = 1; i <= cols / 4; i++) {
      const c = (cols / 2 + side * i + cols) % cols; // front column, from the centre out to the side
      const b = (cols / 2 - c + cols) % cols; // back column at the same x (the side column maps to itself)
      if (top[c].pn > 0) continue;
      pairs.push([ids[0][c], ids[0][b], (c / cols) * (circ / 0.25)]);
    }
    B.bridge(pairs, L, [0, 1, 0]);
  }
  // trims: buttons down the front centre (shirt placket, kurta placket, jacket front)
  if (T.buttons) {
    const reach = T.placket ? Math.min(L, T.placket + T.neck.front) : Math.min(L - 0.05, m.torsoLen * 1.05);
    const r0 = Math.max(1, rowAt(T.neck.front + 0.03));
    const r1 = Math.min(rows - 2, rowAt(reach));
    const fc = cols / 2; // column at the front centre
    B.trims = [];
    for (let i = 0; i < T.buttons; i++) {
      const r = Math.round(lerp(r0, r1, T.buttons > 1 ? i / (T.buttons - 1) : 0));
      B.trims.push({ kind: 'button', a: ids[r][fc], b: ids[r][fc - 1], n: ids[Math.min(rows - 1, r + 1)][fc] });
    }
  }
  B.tetherColumn(ids, 0, 1.05);
}

function skinAt(T, v, m, L) {
  const [top, waist, hem] = T.skin;
  const vW = m.torsoLen * 0.62;
  if (v < 0.18) return top;
  if (v < vW) return lerp(top, waist, smooth(0.18, vW, v));
  return lerp(waist, hem, smooth(vW, Math.max(vW + 0.01, L), v));
}

// ---------------------------------------------------------------- sleeves
// A tube along the upper arm whose top edge follows the armhole: high over the shoulder point,
// low at the armpit. The cap overlaps the body panel so the seam never opens.
function buildSleeve(B, T, spec, m, J, side, res) {
  const S = SLEEVES[T.sleeve];
  const Ls = spec.dims.sleeve || S.len(m);
  const sh = J[side + 'Shoulder'],
    el = J[side + 'Elbow'];
  const d = norm(sub(el, sh));
  // inward: from the shoulder towards the body, perpendicular to the arm
  let inward = sub([0, -0.2, 0], sh);
  inward = norm(sub(inward, mul(d, dot(inward, d))));
  const fwd = norm(cross(d, inward));
  const lay = (spec.layer || 0) * 0.01;
  const rTop = Math.max(m.upperArmR * 1.75, (spec.dims.armhole || 0) / (2 * Math.PI)) + lay;
  const rWrist = m.foreArmR * 1.55 + lay;
  const capRise = 0.04,
    armpitU = Math.min(0.11, Ls * 0.7);
  const Rb = m.upperArmR * 1.25 + 0.008 + lay; // shoulder ball plus ease: the cap is a dome over it
  const cols = Math.max(12, Math.round(14 * res));
  const u0s = [];
  for (let c = 0; c < cols; c++) {
    const ph = (c / cols) * Math.PI * 2;
    u0s.push(lerp(-capRise, armpitU, Math.pow((1 + Math.cos(ph)) / 2, 2.4)));
  }
  const rows = Math.max(3, Math.round((Ls + capRise) / (0.038 / res)) + 1);
  const ids = [];
  for (let r = 0; r < rows; r++) {
    const row = [];
    for (let c = 0; c < cols; c++) {
      const ph = (c / cols) * Math.PI * 2;
      const u = u0s[c] + (r / (rows - 1)) * (Ls - u0s[c]);
      const t = Math.max(0, u) / Math.max(Ls, 0.01);
      let rad = S.cuff
        ? lerp(rTop, rTop * S.cuff, t)
        : lerp(rTop, rWrist, smooth(0, 1, Math.min(1, Math.max(0, u) / (m.upperArm + m.foreArm))));
      if (u < 0) rad = Math.sqrt(Math.max(1e-6, Rb * Rb - u * u));
      else rad = lerp(Rb, rad, smooth(0, 0.07, u));
      // the armhole edge tucks a little under the body panel (front, back and underarm), so the two overlap
      // instead of meeting edge to surface, which leaves hairline cracks
      if (r === 0) rad *= 1 - 0.08 * smooth(-0.3, 0.3, Math.cos(ph));
      const center = add(sh, mul(d, u));
      const p = add(center, add(mul(inward, Math.cos(ph) * rad), mul(fwd, Math.sin(ph) * rad)));
      const seg = u < m.upperArm ? (side === 'l' ? SEG.UARM_L : SEG.UARM_R) : side === 'l' ? SEG.FARM_L : SEG.FARM_R;
      const w = r === 0 ? 0 : lerp(0.3, 0.14, t);
      // the inner side of the upper sleeve overlaps the torso and hides under the body panel
      const cm = u < m.upperArm * 0.6 ? CGROUP.ALL & ~(CGROUP.TORSO | CGROUP.SHOULDER) : CGROUP.ALL;
      // the armhole seam belongs to the body: near the cap, blend the sleeve towards the torso so lifting the
      // arm stretches the underarm fabric instead of opening a gap
      const capW = smooth(-0.6, 0.9, Math.cos(ph)) * (1 - smooth(0, 0.09, u - u0s[c])) * 0.85 + (r === 0 ? 0.1 : 0);
      row.push(B.particle(p, seg, r === 0, w, cm, SEG.TORSO, Math.min(0.95, capW)));
    }
    ids.push(row);
  }
  const circ = rTop * 2 * Math.PI;
  B.grid(
    ids,
    true,
    () => false,
    (r, c) => {
      const cc = c % cols;
      const u = u0s[cc] + (r / (rows - 1)) * (Ls - u0s[cc]);
      return [(c / cols) * (circ / 0.25), -u / 0.25, Ls - u];
    },
    (p) => {
      const q = sub(p, sh);
      return sub(q, mul(d, dot(q, d)));
    },
  );
  B.tetherColumn(ids, 0, 1.05);
}

// ---------------------------------------------------------------- dupatta / stole
// A long strip laid along a path over the body. Columns resting on top of the shoulders are pinned
// (gathered into soft pleats); everything else hangs and swings.
// drape: 'stole' (behind the neck, both ends down the front), 'shoulder' (over the left shoulder,
// one end in front and one behind).
export const DRAPES = { stole: 'Stole', shoulder: 'One shoulder' };

function dupattaPath(drape, m, total, layer) {
  const sx = m.shoulderW / 2;
  const front = m.chestB + 0.025 + layer * 0.012,
    back = m.chestB * 0.95 + 0.025 + layer * 0.012;
  const xs = sx * 0.62;
  const yS = shoulderTop(m, xs) + 0.012 + layer * 0.006;
  if (drape === 'shoulder') {
    const mid = [
      [xs * 0.95, -0.12, front * 0.95],
      [xs, yS, 0.03],
      [xs, yS, -0.03],
      [xs * 0.95, -0.12, -back * 0.95],
    ];
    const rest = Math.max(0.2, total - pathLen(mid));
    const endF = 0.12 + rest * 0.42,
      endB = 0.12 + rest * 0.58;
    return { pts: [[xs * 0.8, -endF, front * 1.05], ...mid, [xs * 0.8, -endB, -back * 1.0]], yPin: yS - 0.02 };
  }
  // stole: over both shoulders and behind the neck, both ends down the front
  const hang = Math.min(1.0, (total - 0.7) / 2);
  const pts = [
    [xs * 0.9, -hang, front * 1.05],
    [xs, -0.12, front * 0.95],
    [xs, yS - 0.01, front * 0.35],
    [sx * 0.5, yS + 0.01, -0.02],
    [sx * 0.3, yS + 0.005, -m.neckR * 1.4],
    [0, yS, -m.neckR * 1.6],
    [-sx * 0.3, yS + 0.005, -m.neckR * 1.4],
    [-sx * 0.5, yS + 0.01, -0.02],
    [-xs, yS - 0.01, front * 0.35],
    [-xs, -0.12, front * 0.95],
    [-xs * 0.9, -hang, front * 1.05],
  ];
  return { pts, yPin: yS - 0.03 };
}
function pathLen(pts) {
  let t = 0;
  for (let i = 1; i < pts.length; i++) t += len(sub(pts[i], pts[i - 1]));
  return t;
}

function buildDupatta(B, spec, m, J, res) {
  const d = spec.dims;
  const total = d.length || 2.25;
  const width = d.width || 0.9;
  const drape = spec.drape || 'stole';
  const layer = spec.layer || 0;
  const wFree = drape === 'shoulder' ? Math.min(0.3, width * 0.34) : Math.min(0.22, width * 0.26);
  const gathered = 0.08;
  const { pts, yPin } = dupattaPath(drape, m, total, layer);
  const segLen = [];
  let tot = 0;
  for (let i = 1; i < pts.length; i++) {
    const l = len(sub(pts[i], pts[i - 1]));
    segLen.push(l);
    tot += l;
  }
  const cols = Math.max(24, Math.round(tot / (0.045 / res)));
  const rows = Math.max(9, Math.round(13 * res));
  const at = (s) => {
    let acc = 0;
    for (let i = 0; i < segLen.length; i++) {
      if (s <= acc + segLen[i] || i === segLen.length - 1) {
        const t = (s - acc) / segLen[i];
        return { p: vec.lerp3(pts[i], pts[i + 1], Math.min(1, Math.max(0, t))), tan: norm(sub(pts[i + 1], pts[i])) };
      }
      acc += segLen[i];
    }
  };
  // arc position and pin state per column
  const S = [],
    pin = [];
  for (let c = 0; c < cols; c++) {
    const s = (c / (cols - 1)) * tot;
    S.push(s);
    pin.push(at(s).p[1] > yPin);
  }
  const pinnedCols = [];
  for (let c = 0; c < cols; c++) if (pin[c]) pinnedCols.push(c);
  const nearestPin = (c) => {
    let best = -1,
      bd = Infinity;
    for (const pc of pinnedCols) {
      const dd = Math.abs(S[pc] - S[c]);
      if (dd < bd) {
        bd = dd;
        best = pc;
      }
    }
    return [best, bd];
  };
  const ids = [];
  for (let r = 0; r < rows; r++) ids.push([]);
  for (let c = 0; c < cols; c++) {
    const { p, tan } = at(S[c]);
    const [, dist] = nearestPin(c);
    const radial = norm([p[0] * 0.35, 0, p[2]]);
    const up = smooth(yPin - 0.05, yPin + 0.01, p[1]);
    const nrm = norm(add(mul(radial, 1 - up * 0.7), [0, up, 0]));
    const wdir = norm(cross(tan, nrm));
    const fan = smooth(0, 0.2, dist);
    const wNow = lerp(gathered, wFree, fan);
    for (let r = 0; r < rows; r++) {
      const off = (r / (rows - 1) - 0.5) * wNow;
      // soft pleats across the width that the bend constraints remember
      const pleat = pin[c] ? 0 : lerp(0.004, 0.014, fan);
      const q = add(add(p, mul(wdir, off)), mul(nrm, pleat * Math.sin((r / (rows - 1)) * Math.PI * 5)));
      ids[r].push(B.particle(q, SEG.TORSO, pin[c], 0));
    }
  }
  B.grid(
    ids,
    false,
    () => false,
    (r, c) => {
      const across = (r / (rows - 1)) * width;
      return [S[c] / 0.25, across / 0.25, Math.min(S[c], tot - S[c], across, width - across)];
    },
    null,
  );
  // tethers: every free particle stays within its arc distance of the nearest pinned column
  if (pinnedCols.length) {
    for (let c = 0; c < cols; c++) {
      if (pin[c]) continue;
      const [pc, dist] = nearestPin(c);
      for (let r = 0; r < rows; r++) {
        const i = ids[r][c];
        B.tAnchor[i] = ids[r][pc];
        B.tMax[i] = Math.max(len(sub(B.P(i), B.P(ids[r][pc]))), dist) * 1.04;
      }
    }
  }
}

/**
 * A curtain panel hanging from a rail: width x height (m), gathered into pleats. Top row pinned.
 * Local frame: rail along x at y = 0, cloth hangs to -height, pleats in z.
 */
export function buildCurtain(width, height, res = 1, gather = 1.6) {
  const B = new Builder([{ o: [0, 0, 0], x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1] }]);
  const cols = Math.max(12, Math.round((width * gather) / (0.05 / res)));
  const rows = Math.max(8, Math.round(height / (0.07 / res)) + 1);
  const pleatW = width / Math.max(4, Math.round(width / 0.12));
  const amp = (pleatW / 2) * Math.sqrt(Math.max(0, gather * gather - 1)) * 0.9;
  const ids = [];
  for (let r = 0; r < rows; r++) {
    const row = [];
    const y = -(r / (rows - 1)) * height;
    for (let c = 0; c < cols; c++) {
      const x = (c / (cols - 1) - 0.5) * width;
      const z = Math.sin((x / pleatW) * Math.PI * 2) * amp * (1 - 0.35 * (r / (rows - 1)));
      row.push(B.particle([x, y, z], 0, r === 0, 0));
    }
    ids.push(row);
  }
  B.grid(
    ids,
    false,
    () => false,
    (r, c) => [
      ((c / (cols - 1)) * width * gather) / 0.25,
      -((r / (rows - 1)) * height) / 0.25,
      (1 - r / (rows - 1)) * height,
    ],
    null,
  );
  B.tetherColumn(ids, 0, 1.02);
  return B.finish({ template: 'dupatta' });
}

/** Per-particle normals for the render mesh (smooth across seams). */
export function computeNormals(g, pos, out) {
  const { index, map } = g.render;
  const np = g.rest.length / 3;
  const acc = new Float32Array(np * 3);
  for (let t = 0; t < index.length; t += 3) {
    const a = map[index[t]],
      b = map[index[t + 1]],
      c = map[index[t + 2]];
    const ax = pos[a * 3],
      ay = pos[a * 3 + 1],
      az = pos[a * 3 + 2];
    const e1x = pos[b * 3] - ax,
      e1y = pos[b * 3 + 1] - ay,
      e1z = pos[b * 3 + 2] - az;
    const e2x = pos[c * 3] - ax,
      e2y = pos[c * 3 + 1] - ay,
      e2z = pos[c * 3 + 2] - az;
    const nx = e1y * e2z - e1z * e2y,
      ny = e1z * e2x - e1x * e2z,
      nz = e1x * e2y - e1y * e2x;
    acc[a * 3] += nx;
    acc[a * 3 + 1] += ny;
    acc[a * 3 + 2] += nz;
    acc[b * 3] += nx;
    acc[b * 3 + 1] += ny;
    acc[b * 3 + 2] += nz;
    acc[c * 3] += nx;
    acc[c * 3 + 1] += ny;
    acc[c * 3 + 2] += nz;
  }
  const rv = map.length;
  for (let v = 0; v < rv; v++) {
    const p = map[v];
    let x = acc[p * 3],
      y = acc[p * 3 + 1],
      z = acc[p * 3 + 2];
    const l = Math.hypot(x, y, z) || 1;
    out[v * 3] = x / l;
    out[v * 3 + 1] = y / l;
    out[v * 3 + 2] = z / l;
  }
  return out;
}

/** Copy particle positions into the render position buffer. */
export function copyPositions(g, pos, out) {
  const map = g.render.map;
  for (let v = 0; v < map.length; v++) {
    const p = map[v] * 3;
    out[v * 3] = pos[p];
    out[v * 3 + 1] = pos[p + 1];
    out[v * 3 + 2] = pos[p + 2];
  }
  return out;
}

export { toWorld };
