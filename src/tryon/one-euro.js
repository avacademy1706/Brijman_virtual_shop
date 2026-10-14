// One Euro filter (Casiez, Roussel and Vogel, 2012): smooths jitter when still, follows fast movement without lag.

const alpha = (cutoff, dt) => {
  const tau = 1 / (2 * Math.PI * cutoff);
  return 1 / (1 + tau / dt);
};

/** Filters one value. */
export class OneEuroFilter {
  /**
   * @param {{minCutoff?: number, beta?: number, dCutoff?: number}} [o]
   *   minCutoff (Hz): lower = smoother when still. beta: higher = less lag when moving fast.
   */
  constructor(o = {}) {
    this.minCutoff = o.minCutoff ?? 1.2;
    this.beta = o.beta ?? 0.02;
    this.dCutoff = o.dCutoff ?? 1;
    this.reset();
  }
  reset() {
    this.x = null;
    this.dx = 0;
    this.t = null;
  }
  /**
   * @param {number} value
   * @param {number} t time in seconds
   */
  filter(value, t) {
    if (this.x === null || this.t === null || t <= this.t) {
      if (this.x === null) this.x = value;
      this.t = t;
      return this.x;
    }
    const dt = t - this.t;
    this.t = t;
    const dx = (value - this.x) / dt;
    this.dx += alpha(this.dCutoff, dt) * (dx - this.dx);
    const cutoff = this.minCutoff + this.beta * Math.abs(this.dx);
    this.x += alpha(cutoff, dt) * (value - this.x);
    return this.x;
  }
}

/** Filters a fixed-length vector component by component. */
export class OneEuroVector {
  constructor(n, o) {
    this.f = Array.from({ length: n }, () => new OneEuroFilter(o));
  }
  reset() {
    this.f.forEach((f) => f.reset());
  }
  filter(v, t) {
    return v.map((x, i) => this.f[i].filter(x, t));
  }
}

/** Filters a unit quaternion [x, y, z, w], keeping it on the same hemisphere so it never flips. */
export class OneEuroQuaternion {
  constructor(o) {
    this.v = new OneEuroVector(4, o);
    this.last = null;
  }
  reset() {
    this.v.reset();
    this.last = null;
  }
  filter(q, t) {
    let x = q;
    if (this.last && x[0] * this.last[0] + x[1] * this.last[1] + x[2] * this.last[2] + x[3] * this.last[3] < 0)
      x = x.map((c) => -c);
    const f = this.v.filter(x, t);
    const l = Math.hypot(f[0], f[1], f[2], f[3]) || 1;
    this.last = f.map((c) => c / l);
    return this.last;
  }
}
