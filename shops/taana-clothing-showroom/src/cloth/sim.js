// Position-based cloth simulation (Verlet integration + distance constraints).
// Pure JavaScript with typed arrays: no DOM and no three.js, so the same code runs in the browser
// (live try-on, product viewer, fitting-room mannequin) and in Node (scripts/bake-drapes.mjs).
//
// Features
// - stretch / compression / bending as separate distance constraints with their own stiffness
// - long-range tethers (each free particle cannot drift further than its rest distance from an anchor)
// - kinematic pins and soft "skinning" pulls toward body-attached targets
// - collisions with spheres, tapered capsules, an elliptic-cylinder torso and planes, with friction

export const COLL = { SPHERE: 0, CAPSULE: 1, TORSO: 2, PLANE: 3 };

/**
 * Settings that make the cloth behave like fabric rather than rubber or jelly.
 * - skinDamp: share of each pull toward the body that is NOT turned into velocity. Without it the pulls act
 *   as springs and the cloth wobbles around the body after every move.
 * - deformDamp: per substep, how much of each particle's velocity that differs from the cloth's overall
 *   (rigid) motion is removed. Kills jiggle and ringing while the garment as a whole still swings and twirls.
 * - strainLimit: hard cap on how far a seam line may stretch (fraction of its rest length). Woven fabric
 *   barely stretches; without the cap a fast move stretches it like elastic and it snaps back.
 * - relFriction: friction against the body is measured relative to the moving body, not the room, so a
 *   turning torso carries the fabric with it instead of braking it.
 */
export const TUNE = { skinDamp: 0.85, deformDamp: 0.06, strainLimit: 0.03, relFriction: true };
/** Collision groups: each collider has one bit, each particle a mask of the groups it collides with. */
export const CGROUP = { TORSO: 1, SHOULDER: 2, HEAD: 4, UARM: 8, FARM: 16, LEG: 32, WORLD: 64, ALL: 255 };

export class ClothSim {
  /**
   * @param {object} g geometry description from a garment builder
   * @param {Float32Array} g.rest rest positions (xyz per particle)
   * @param {Uint32Array} g.cons constraint particle pairs (a,b per constraint)
   * @param {Float32Array} g.consRest rest lengths
   * @param {Uint8Array} g.consType 0 structural, 1 shear, 2 bend
   * @param {Uint8Array} g.pinned 1 for kinematic particles
   * @param {Float32Array} g.skin per-particle pull strength toward its target (0..1 per substep)
   * @param {Int32Array} g.tetherAnchor anchor particle index per particle (-1 for none)
   * @param {Float32Array} g.tetherMax max distance to the anchor
   * @param {Uint8Array} [g.cmask] collision groups each particle tests (default: all)
   */
  constructor(g, fabric) {
    this.n = g.rest.length / 3;
    this.pos = new Float32Array(g.rest);
    this.prev = new Float32Array(g.rest);
    this.target = new Float32Array(g.rest);
    this.targetPrev = new Float32Array(g.rest);
    this.cons = g.cons;
    this.consRest = g.consRest;
    this.consType = g.consType;
    this.pinned = g.pinned;
    this.skin = g.skin;
    this.tAnchor = g.tetherAnchor;
    this.tMax = g.tetherMax;
    this.cmask = g.cmask || new Uint8Array(this.n).fill(255);
    this.setFabric(fabric);
    this.colliders = [];
    this.gravity = [0, -9.81, 0];
    this.margin = 0.006;
    this.friction = 0.35;
    this.maxSpeed = 3; // m/s clamp, protects against tracking glitches
    this.free = [];
    for (let i = 0; i < this.n; i++) if (!this.pinned[i]) this.free.push(i);
    this.free = Uint32Array.from(this.free);
    this.tethered = [];
    for (let i = 0; i < this.n; i++) if (this.tAnchor[i] >= 0) this.tethered.push(i);
    this.tethered = Uint32Array.from(this.tethered);
  }

  setFabric(f) {
    this.fabric = f;
    // stiffness per constraint type: [stretch, compress] for structural, shear, bend
    this.kS = [f.stretch, f.shear, f.bend];
    this.kC = [f.compress, f.shear * 0.5, f.bendCompress];
    this.dampPerSec = f.damping; // fraction of velocity kept after one second
    this.iterations = f.iterations || 6;
  }

  /** Move kinematic targets for this frame. Call before step(). */
  setTargets(targets) {
    // if the last call ran no step, the body motion since then is still pending: keep its start
    if (this.stepped !== false) this.targetPrev.set(this.target);
    this.target.set(targets);
  }

  /** Jump everything to the targets (used after a size or garment change, or tracking loss). */
  snapToTargets() {
    for (let i = 0; i < this.n; i++) {
      const k = i * 3;
      if (this.pinned[i] || this.skin[i] > 0) {
        this.pos[k] = this.prev[k] = this.targetPrev[k] = this.target[k];
        this.pos[k + 1] = this.prev[k + 1] = this.targetPrev[k + 1] = this.target[k + 1];
        this.pos[k + 2] = this.prev[k + 2] = this.targetPrev[k + 2] = this.target[k + 2];
      }
    }
  }

  /** Teleport the whole cloth by a rigid offset (keeps the drape when the body jumps). */
  translate(dx, dy, dz) {
    for (let i = 0; i < this.n; i++) {
      const k = i * 3;
      this.pos[k] += dx;
      this.pos[k + 1] += dy;
      this.pos[k + 2] += dz;
      this.prev[k] += dx;
      this.prev[k + 1] += dy;
      this.prev[k + 2] += dz;
    }
  }

  step(dt, substeps = 4) {
    dt = Math.min(dt, 1 / 20);
    // Fixed internal step. The resting shape of position-based cloth depends on the step length, so if the
    // step followed an uneven frame clock (common on 120/144 Hz screens and busy machines) the cloth would hop
    // between slightly different shapes and shake while standing still. The first call fixes the step
    // (between 1/300 s and 1/60 s); every call then runs as many whole steps as its time covers.
    if (!this.fixedH) this.fixedH = Math.max(1 / 300, Math.min(1 / 60, Math.min(dt, 1 / 30) / substeps));
    this.acc = (this.acc || 0) + dt;
    let steps = Math.floor(this.acc / this.fixedH + 1e-6);
    const cap = Math.max(4, substeps * 4);
    if (steps > cap) {
      steps = cap;
      this.acc = 0;
    } else this.acc -= steps * this.fixedH;
    this.stepped = steps > 0;
    if (!steps) return;
    substeps = steps;
    const h = this.fixedH,
      h2 = h * h;
    const damp = Math.pow(this.dampPerSec, h);
    const gx = this.gravity[0] * h2,
      gy = this.gravity[1] * h2,
      gz = this.gravity[2] * h2;
    const vmax = this.maxSpeed * h;
    const { pos, prev, target, targetPrev, pinned, skin, n } = this;
    // body motion per substep at each skinned particle (for friction relative to the body)
    if (!this.tv || this.tv.length !== pos.length) this.tv = new Float32Array(pos.length);
    const tv = this.tv;
    for (let i = 0; i < pos.length; i++) tv[i] = (target[i] - targetPrev[i]) / substeps;
    const skinDamp = TUNE.skinDamp;
    for (let s = 1; s <= substeps; s++) {
      const t = s / substeps;
      if (TUNE.deformDamp > 0) this.dampDeformation(TUNE.deformDamp);
      // 1. integrate (free particles) and move kinematic ones
      for (let i = 0; i < n; i++) {
        const k = i * 3;
        if (pinned[i]) {
          prev[k] = pos[k];
          prev[k + 1] = pos[k + 1];
          prev[k + 2] = pos[k + 2];
          pos[k] = targetPrev[k] + (target[k] - targetPrev[k]) * t;
          pos[k + 1] = targetPrev[k + 1] + (target[k + 1] - targetPrev[k + 1]) * t;
          pos[k + 2] = targetPrev[k + 2] + (target[k + 2] - targetPrev[k + 2]) * t;
          continue;
        }
        let vx = (pos[k] - prev[k]) * damp,
          vy = (pos[k + 1] - prev[k + 1]) * damp,
          vz = (pos[k + 2] - prev[k + 2]) * damp;
        const sp = Math.sqrt(vx * vx + vy * vy + vz * vz);
        if (sp > vmax) {
          const f = vmax / sp;
          vx *= f;
          vy *= f;
          vz *= f;
        }
        prev[k] = pos[k];
        prev[k + 1] = pos[k + 1];
        prev[k + 2] = pos[k + 2];
        pos[k] += vx + gx;
        pos[k + 1] += vy + gy;
        pos[k + 2] += vz + gz;
        const w = skin[i];
        if (w > 0) {
          const tx = targetPrev[k] + (target[k] - targetPrev[k]) * t;
          const ty = targetPrev[k + 1] + (target[k + 1] - targetPrev[k + 1]) * t;
          const tz = targetPrev[k + 2] + (target[k + 2] - targetPrev[k + 2]) * t;
          const cx = (tx - pos[k]) * w,
            cy = (ty - pos[k + 1]) * w,
            cz = (tz - pos[k + 2]) * w;
          pos[k] += cx;
          pos[k + 1] += cy;
          pos[k + 2] += cz;
          // move the previous position too, so the pull drags the cloth along instead of acting as a spring
          prev[k] += cx * skinDamp;
          prev[k + 1] += cy * skinDamp;
          prev[k + 2] += cz * skinDamp;
        }
      }
      // 2. constraints
      for (let it = 0; it < this.iterations; it++) {
        this.solveDistance();
        if (it === this.iterations - 1 || it & 1) this.solveTethers();
      }
      if (TUNE.strainLimit > 0) this.limitStrain(1 + TUNE.strainLimit);
      // 3. collisions
      if (this.colliders.length) this.collide();
    }
  }

  solveDistance() {
    const { pos, pinned, cons, consRest, consType, kS, kC } = this;
    const m = consRest.length;
    for (let c = 0; c < m; c++) {
      const a = cons[c * 2],
        b = cons[c * 2 + 1];
      const wa = pinned[a] ? 0 : 1,
        wb = pinned[b] ? 0 : 1;
      const w = wa + wb;
      if (!w) continue;
      const ka = a * 3,
        kb = b * 3;
      const dx = pos[kb] - pos[ka],
        dy = pos[kb + 1] - pos[ka + 1],
        dz = pos[kb + 2] - pos[ka + 2];
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (len < 1e-9) continue;
      const r = consRest[c];
      const diff = (len - r) / len;
      const typ = consType[c];
      const k = diff > 0 ? kS[typ] : kC[typ];
      if (!k) continue;
      const f = (k * diff) / w;
      if (wa) {
        pos[ka] += dx * f;
        pos[ka + 1] += dy * f;
        pos[ka + 2] += dz * f;
      }
      if (wb) {
        pos[kb] -= dx * f;
        pos[kb + 1] -= dy * f;
        pos[kb + 2] -= dz * f;
      }
    }
  }

  /**
   * Remove part of every particle's velocity that differs from the best-fit rigid motion of the whole cloth
   * (Mueller et al., Position Based Dynamics, 2007, section 3.5). Internal wobble dies out quickly; swinging,
   * twirling and falling as a whole are kept.
   */
  dampDeformation(k) {
    const { pos, prev, n, pinned } = this;
    let mx = 0,
      my = 0,
      mz = 0,
      vx = 0,
      vy = 0,
      vz = 0;
    for (let j = 0; j < n * 3; j += 3) {
      mx += pos[j];
      my += pos[j + 1];
      mz += pos[j + 2];
      vx += pos[j] - prev[j];
      vy += pos[j + 1] - prev[j + 1];
      vz += pos[j + 2] - prev[j + 2];
    }
    mx /= n;
    my /= n;
    mz /= n;
    vx /= n;
    vy /= n;
    vz /= n;
    // angular momentum L and inertia tensor I about the centre
    let Lx = 0,
      Ly = 0,
      Lz = 0,
      Ixx = 0,
      Iyy = 0,
      Izz = 0,
      Ixy = 0,
      Ixz = 0,
      Iyz = 0;
    for (let j = 0; j < n * 3; j += 3) {
      const rx = pos[j] - mx,
        ry = pos[j + 1] - my,
        rz = pos[j + 2] - mz;
      const ux = pos[j] - prev[j],
        uy = pos[j + 1] - prev[j + 1],
        uz = pos[j + 2] - prev[j + 2];
      Lx += ry * uz - rz * uy;
      Ly += rz * ux - rx * uz;
      Lz += rx * uy - ry * ux;
      Ixx += ry * ry + rz * rz;
      Iyy += rx * rx + rz * rz;
      Izz += rx * rx + ry * ry;
      Ixy -= rx * ry;
      Ixz -= rx * rz;
      Iyz -= ry * rz;
    }
    // angular velocity w = I^-1 L (symmetric 3x3 inverse by cofactors)
    const c00 = Iyy * Izz - Iyz * Iyz,
      c01 = Ixz * Iyz - Ixy * Izz,
      c02 = Ixy * Iyz - Ixz * Iyy,
      c11 = Ixx * Izz - Ixz * Ixz,
      c12 = Ixy * Ixz - Ixx * Iyz,
      c22 = Ixx * Iyy - Ixy * Ixy;
    const det = Ixx * c00 + Ixy * c01 + Ixz * c02;
    if (!(Math.abs(det) > 1e-18)) return;
    const wx = (c00 * Lx + c01 * Ly + c02 * Lz) / det,
      wy = (c01 * Lx + c11 * Ly + c12 * Lz) / det,
      wz = (c02 * Lx + c12 * Ly + c22 * Lz) / det;
    for (let i = 0, j = 0; i < n; i++, j += 3) {
      if (pinned[i]) continue;
      const rx = pos[j] - mx,
        ry = pos[j + 1] - my,
        rz = pos[j + 2] - mz;
      // rigid-fit velocity at this particle minus its own velocity
      const dx = vx + wy * rz - wz * ry - (pos[j] - prev[j]),
        dy = vy + wz * rx - wx * rz - (pos[j + 1] - prev[j + 1]),
        dz = vz + wx * ry - wy * rx - (pos[j + 2] - prev[j + 2]);
      prev[j] -= dx * k;
      prev[j + 1] -= dy * k;
      prev[j + 2] -= dz * k;
    }
  }

  /** Woven fabric barely stretches: pull every over-stretched structural edge back to the cap. */
  limitStrain(cap) {
    const { pos, pinned, cons, consRest, consType } = this;
    const m = consRest.length;
    for (let c = 0; c < m; c++) {
      if (consType[c] !== 0) continue;
      const a = cons[c * 2],
        b = cons[c * 2 + 1];
      const wa = pinned[a] ? 0 : 1,
        wb = pinned[b] ? 0 : 1;
      const w = wa + wb;
      if (!w) continue;
      const ka = a * 3,
        kb = b * 3;
      const dx = pos[kb] - pos[ka],
        dy = pos[kb + 1] - pos[ka + 1],
        dz = pos[kb + 2] - pos[ka + 2];
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const lim = consRest[c] * cap;
      if (len <= lim || len < 1e-9) continue;
      const f = (len - lim) / len / w;
      if (wa) {
        pos[ka] += dx * f;
        pos[ka + 1] += dy * f;
        pos[ka + 2] += dz * f;
      }
      if (wb) {
        pos[kb] -= dx * f;
        pos[kb + 1] -= dy * f;
        pos[kb + 2] -= dz * f;
      }
    }
  }

  solveTethers() {
    const { pos, tAnchor, tMax, tethered } = this;
    for (let j = 0; j < tethered.length; j++) {
      const i = tethered[j],
        a = tAnchor[i];
      const k = i * 3,
        ka = a * 3;
      const dx = pos[k] - pos[ka],
        dy = pos[k + 1] - pos[ka + 1],
        dz = pos[k + 2] - pos[ka + 2];
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz),
        mx = tMax[i];
      if (d > mx) {
        const f = mx / d;
        pos[k] = pos[ka] + dx * f;
        pos[k + 1] = pos[ka + 1] + dy * f;
        pos[k + 2] = pos[ka + 2] + dz * f;
      }
    }
  }

  collide() {
    const { pos, prev, free, colliders, margin, cmask, skin } = this;
    const mu = this.friction;
    const tv = TUNE.relFriction ? this.tv : null;
    for (let j = 0; j < free.length; j++) {
      const i = free[j],
        k = i * 3,
        cm = cmask[i];
      let px = pos[k],
        py = pos[k + 1],
        pz = pos[k + 2];
      let hit = false,
        nx = 0,
        ny = 0,
        nz = 0;
      for (let c = 0; c < colliders.length; c++) {
        const C = colliders[c];
        if (!(C.group & cm)) continue;
        let qx, qy, qz, r;
        if (C.type === COLL.SPHERE) {
          qx = px - C.c[0];
          qy = py - C.c[1];
          qz = pz - C.c[2];
          r = C.r + margin;
          const d2 = qx * qx + qy * qy + qz * qz;
          if (d2 < r * r && d2 > 1e-12) {
            const d = Math.sqrt(d2),
              f = r / d;
            px = C.c[0] + qx * f;
            py = C.c[1] + qy * f;
            pz = C.c[2] + qz * f;
            hit = true;
            nx = qx / d;
            ny = qy / d;
            nz = qz / d;
          }
        } else if (C.type === COLL.CAPSULE) {
          const ax = C.a[0],
            ay = C.a[1],
            az = C.a[2];
          const ex = C.b[0] - ax,
            ey = C.b[1] - ay,
            ez = C.b[2] - az;
          const L2 = ex * ex + ey * ey + ez * ez;
          let t = L2 > 0 ? ((px - ax) * ex + (py - ay) * ey + (pz - az) * ez) / L2 : 0;
          t = t < 0 ? 0 : t > 1 ? 1 : t;
          const cx = ax + ex * t,
            cy = ay + ey * t,
            cz = az + ez * t;
          r = C.ra + (C.rb - C.ra) * t + margin;
          qx = px - cx;
          qy = py - cy;
          qz = pz - cz;
          const d2 = qx * qx + qy * qy + qz * qz;
          if (d2 < r * r && d2 > 1e-12) {
            const d = Math.sqrt(d2),
              f = r / d;
            px = cx + qx * f;
            py = cy + qy * f;
            pz = cz + qz * f;
            hit = true;
            nx = qx / d;
            ny = qy / d;
            nz = qz / d;
          }
        } else if (C.type === COLL.TORSO) {
          // elliptic cylinder: frame o,x,y,z; profile rows (v, a, b) with v measured downwards from o
          const ox = px - C.o[0],
            oy = py - C.o[1],
            oz = pz - C.o[2];
          const lx = ox * C.x[0] + oy * C.x[1] + oz * C.x[2];
          const ly = ox * C.y[0] + oy * C.y[1] + oz * C.y[2];
          const lz = ox * C.z[0] + oy * C.z[1] + oz * C.z[2];
          const v = -ly;
          const P = C.profile;
          if (v < P[0] || v > P[P.length - 3]) continue;
          let a = P[1],
            b = P[2];
          for (let q = 3; q < P.length; q += 3) {
            if (v <= P[q]) {
              const v0 = P[q - 3],
                tt = (v - v0) / (P[q] - v0 || 1);
              a = P[q - 2] + (P[q + 1] - P[q - 2]) * tt;
              b = P[q - 1] + (P[q + 2] - P[q - 1]) * tt;
              break;
            }
          }
          a += margin;
          b += margin;
          const e = (lx * lx) / (a * a) + (lz * lz) / (b * b);
          if (e < 1 && e > 1e-12) {
            const f = 1 / Math.sqrt(e);
            const nlx = lx * f,
              nlz = lz * f;
            const dx = nlx - lx,
              dz = nlz - lz;
            px += C.x[0] * dx + C.z[0] * dz;
            py += C.x[1] * dx + C.z[1] * dz;
            pz += C.x[2] * dx + C.z[2] * dz;
            // ellipse normal in local frame
            let gx = nlx / (a * a),
              gz = nlz / (b * b);
            const gl = Math.sqrt(gx * gx + gz * gz) || 1;
            gx /= gl;
            gz /= gl;
            nx = C.x[0] * gx + C.z[0] * gz;
            ny = C.x[1] * gx + C.z[1] * gz;
            nz = C.x[2] * gx + C.z[2] * gz;
            hit = true;
          }
        } else if (C.type === COLL.PLANE) {
          const d = px * C.n[0] + py * C.n[1] + pz * C.n[2] - C.d - margin;
          if (d < 0 && (!C.bounds || inBounds(C.bounds, px, pz))) {
            px -= C.n[0] * d;
            py -= C.n[1] * d;
            pz -= C.n[2] * d;
            hit = true;
            nx = C.n[0];
            ny = C.n[1];
            nz = C.n[2];
          }
        }
      }
      if (hit) {
        pos[k] = px;
        pos[k + 1] = py;
        pos[k + 2] = pz;
        // friction: remove part of the tangential velocity, measured against the body where the cloth is
        // attached to it (so a turning torso carries the fabric along)
        const rel = tv && skin[i] > 0;
        const vx = px - prev[k] - (rel ? tv[k] : 0),
          vy = py - prev[k + 1] - (rel ? tv[k + 1] : 0),
          vz = pz - prev[k + 2] - (rel ? tv[k + 2] : 0);
        const vn = vx * nx + vy * ny + vz * nz;
        const tx = vx - vn * nx,
          ty = vy - vn * ny,
          tz = vz - vn * nz;
        prev[k] += tx * mu;
        prev[k + 1] += ty * mu;
        prev[k + 2] += tz * mu;
      }
    }
  }

  /** True if any coordinate is not finite (used by tests and as a safety reset). */
  broken() {
    for (let i = 0; i < this.pos.length; i++) if (!Number.isFinite(this.pos[i])) return true;
    return false;
  }
}

/**
 * Push a single point out of the colliders whose group is in `mask` (used when building rest shapes).
 * Same geometry as ClothSim.collide(); returns a new array.
 */
export function resolvePoint(p, colliders, margin = 0.006, mask = CGROUP.ALL, passes = 3) {
  const s = new ClothSim(
    {
      rest: Float32Array.from(p),
      cons: new Uint32Array(0),
      consRest: new Float32Array(0),
      consType: new Uint8Array(0),
      pinned: new Uint8Array(1),
      skin: new Float32Array(1),
      tetherAnchor: Int32Array.of(-1),
      tetherMax: new Float32Array(1),
      cmask: Uint8Array.of(mask),
    },
    FABRICS.cotton,
  );
  s.colliders = colliders;
  s.margin = margin;
  s.friction = 0;
  for (let i = 0; i < passes; i++) s.collide();
  return [s.pos[0], s.pos[1], s.pos[2]];
}

function inBounds(b, x, z) {
  return x >= b[0] && x <= b[1] && z >= b[2] && z <= b[3];
}

/** Fabric presets: stiffness (0..1 per iteration), damping (velocity kept per second), look. */
export const FABRICS = {
  cotton: {
    label: 'Cotton',
    stretch: 1,
    compress: 0.087,
    shear: 0.6,
    bend: 0.22,
    bendCompress: 0.012,
    damping: 0.22,
    iterations: 6,
    density: 0.14,
    roughness: 0.88,
    sheen: 0.25,
  },
  linen: {
    label: 'Linen',
    stretch: 1,
    compress: 0.122,
    shear: 0.7,
    bend: 0.35,
    bendCompress: 0.018,
    damping: 0.2,
    iterations: 6,
    density: 0.16,
    roughness: 0.95,
    sheen: 0.15,
  },
  rayon: {
    label: 'Rayon',
    stretch: 1,
    compress: 0.042,
    shear: 0.45,
    bend: 0.08,
    bendCompress: 0.004,
    damping: 0.3,
    iterations: 6,
    density: 0.12,
    roughness: 0.7,
    sheen: 0.45,
  },
  silk: {
    label: 'Silk',
    stretch: 1,
    compress: 0.028,
    shear: 0.4,
    bend: 0.05,
    bendCompress: 0.003,
    damping: 0.32,
    iterations: 6,
    density: 0.09,
    roughness: 0.42,
    sheen: 0.85,
  },
  georgette: {
    label: 'Georgette',
    stretch: 1,
    compress: 0.021,
    shear: 0.35,
    bend: 0.025,
    bendCompress: 0.002,
    damping: 0.35,
    iterations: 6,
    density: 0.07,
    roughness: 0.68,
    sheen: 0.5,
  },
  denim: {
    label: 'Denim',
    stretch: 1,
    compress: 0.21,
    shear: 0.85,
    bend: 0.65,
    bendCompress: 0.06,
    damping: 0.18,
    iterations: 7,
    density: 0.38,
    roughness: 0.96,
    sheen: 0.1,
  },
  chiffon: {
    label: 'Chiffon',
    stretch: 1,
    compress: 0.017,
    shear: 0.3,
    bend: 0.02,
    bendCompress: 0.002,
    damping: 0.38,
    iterations: 6,
    density: 0.05,
    roughness: 0.6,
    sheen: 0.55,
  },
};
