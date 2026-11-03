// Synthetic, animated body poses for the mannequin (product viewer, fitting room, camera-free try-on)
// and for tests. Output uses the same joint format as the camera tracker (metres, y up, z to the viewer).
import { restPose, vec } from './body.js';

const { add, sub, mul } = vec;

function rotY(p, c, a) {
  const s = Math.sin(a),
    co = Math.cos(a);
  const x = p[0] - c[0],
    z = p[2] - c[2];
  return [c[0] + x * co + z * s, p[1], c[2] - x * s + z * co];
}
function rotAround(p, pivot, axis, a) {
  // Rodrigues rotation of p around axis through pivot
  const v = sub(p, pivot);
  const k = vec.norm(axis);
  const c = Math.cos(a),
    s = Math.sin(a);
  const kv = vec.cross(k, v),
    kd = vec.dot(k, v);
  return add(pivot, add(add(mul(v, c), mul(kv, s)), mul(k, kd * (1 - c))));
}

/**
 * @param {object} m measurements
 * @param {number} t seconds
 * @param {object} o { mode: 'idle'|'turn'|'walk'|'showcase'|'still', floorY, x, z, yaw }
 */
export function animatedPose(m, t, o = {}) {
  const J = restPose(m, o.armAngle ?? 0.22);
  const legLen = m.thigh + m.shin + 0.07;
  const lift = (o.floorY ?? 0) + legLen + m.torsoLen; // shoulder-line height above the floor
  const P = {};
  for (const k in J) P[k] = add(J[k], [o.x ?? 0, lift, o.z ?? 0]);
  const hipC = vec.mid(P.lHip, P.rHip);
  const mode = o.mode || 'idle';
  let yaw = o.yaw ?? 0,
    sway = 0,
    breath = mode === 'still' ? 0 : Math.sin(t * 1.6) * 0.004;
  let armL = 0,
    armR = 0,
    elbowL = 0,
    elbowR = 0,
    step = 0;
  if (mode === 'idle') {
    sway = Math.sin(t * 0.7) * 0.015;
    yaw += Math.sin(t * 0.35) * 0.18;
    armL = Math.sin(t * 0.9) * 0.05;
    armR = -Math.sin(t * 0.9 + 1) * 0.05;
  } else if (mode === 'turn') {
    yaw += Math.sin(t * 0.55) * 0.75;
    sway = Math.sin(t * 1.1) * 0.012;
    armL = 0.04;
    armR = 0.04;
  } else if (mode === 'walk') {
    const ph = t * 4.2;
    step = Math.sin(ph);
    sway = Math.sin(ph) * 0.02;
    yaw += Math.sin(t * 0.4) * 0.3;
    armL = -Math.sin(ph) * 0.28;
    armR = Math.sin(ph) * 0.28;
    elbowL = 0.25 + Math.max(0, -Math.sin(ph)) * 0.2;
    elbowR = 0.25 + Math.max(0, Math.sin(ph)) * 0.2;
  } else if (mode === 'showcase') {
    // turn, raise an arm, twirl: shows how the fabric moves
    const cyc = t % 9;
    yaw += Math.sin(t * 0.5) * 0.9;
    sway = Math.sin(t * 1.3) * 0.02;
    const raise = cyc > 4 && cyc < 7 ? Math.sin(((cyc - 4) / 3) * Math.PI) : 0;
    armL = -raise * 1.25;
    elbowL = raise * 0.6;
    armR = Math.sin(t * 0.8) * 0.12;
  }
  // arms: swing forward/back (rotation around the shoulder line) and abduct
  const shoulderAxis = sub(P.lShoulder, P.rShoulder);
  const swingArm = (side, a, bend) => {
    const S = P[side + 'Shoulder'];
    let E = P[side + 'Elbow'],
      W = P[side + 'Wrist'];
    // abduction for big negative values (raising sideways) uses the forward axis, swing uses the shoulder axis
    if (a < -0.3) {
      const ab = -a;
      const sgn = side === 'l' ? 1 : -1;
      E = rotAround(E, S, [0, 0, sgn], ab);
      W = rotAround(W, S, [0, 0, sgn], ab);
    } else {
      E = rotAround(E, S, shoulderAxis, a);
      W = rotAround(W, S, shoulderAxis, a);
    }
    if (bend) W = rotAround(W, E, shoulderAxis, -bend);
    P[side + 'Elbow'] = E;
    P[side + 'Wrist'] = W;
  };
  swingArm('l', armL, elbowL);
  swingArm('r', armR, elbowR);
  if (step) {
    for (const [side, sgn] of [
      ['l', 1],
      ['r', -1],
    ]) {
      const H = P[side + 'Hip'];
      const a = sgn * step * 0.35;
      P[side + 'Knee'] = rotAround(P[side + 'Knee'], H, shoulderAxis, a);
      P[side + 'Ankle'] = rotAround(P[side + 'Ankle'], H, shoulderAxis, a);
      if (a < 0) P[side + 'Ankle'] = rotAround(P[side + 'Ankle'], P[side + 'Knee'], shoulderAxis, a * 1.4);
    }
  }
  // breathing and sway, then the body yaw around the hip centre
  for (const k in P) {
    const above = P[k][1] > hipC[1] - 0.05;
    P[k] = add(P[k], [sway * (above ? 1 : 0.4), above ? breath : 0, 0]);
    P[k] = rotY(P[k], hipC, yaw);
  }
  return P;
}
