// The walkable 3D salon: the procedural interior (salon.js), frames at true size on every shelf and block,
// the walk planner, labels, hover and the product viewer.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import { NY } from '../core/ny.js';
import '../data/catalogue.js';
import '../data/store-layout.js';
import { Batcher } from './batch.js';
import { makeSalonTextures, rng } from './textures.js';
import { buildSalon, salonMaterials, SALON_BATCH } from './salon.js';
import { archGeo, frameMaterials, frameScale, frameGroup, partsFor } from '../frames/geometry.js';
start().catch((err) => {
  console.error(err);
  if (NY && NY.fail3D) NY.fail3D(err);
});

async function start() {
  if (!NY || !NY.L) throw new Error('Showroom data missing');
  const L = NY.L,
    H = L.H,
    EYE = 1.62;
  const V2 = THREE.Vector2,
    V3 = THREE.Vector3;
  const RM = !!NY.reduceMotion;
  const canvas = document.getElementById('scene');
  const coarse = window.matchMedia('(pointer: coarse)').matches;

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  } catch (e) {
    NY.fail3D(e);
    return;
  }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;
  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  // Signage is drawn with the page fonts; wait briefly for them.
  try {
    await Promise.race([
      Promise.all([
        document.fonts.load('500 64px "Bodoni Moda"'),
        document.fonts.load('italic 500 64px "Bodoni Moda"'),
        document.fonts.load('500 24px "Jost"'),
      ]),
      new Promise((r) => setTimeout(r, 1500)),
    ]);
  } catch (e) {
    /* fonts optional */
  }

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#ece6de');
  const camera = new THREE.PerspectiveCamera(60, 1, 0.03, 60);
  camera.rotation.order = 'YXZ';

  /* ------------------------------------------------------------------
     The salon: textures, materials, architecture and fixtures
     ------------------------------------------------------------------ */
  const V2s = THREE.Vector2;
  void V2s;
  const big = !coarse && Math.max(window.screen.width, window.screen.height) >= 1200;
  const tex = makeSalonTextures({ aniso: maxAniso, hi: big });
  const M = salonMaterials(tex);
  const B = new Batcher(scene, M, SALON_BATCH);
  const ctx = { B, M, tex, scene };
  const built = buildSalon(ctx);
  B.flush();
  const floor = ctx.floor;
  const solids = B.solids;
  const hitboxes = B.hitboxes;
  const W = L.x1 - L.x0,
    D = L.z1 - L.z0;
  const basic = (o) => new THREE.MeshBasicMaterial(o);
  const std = (o) => new THREE.MeshStandardMaterial(o);

  /* ------------------------------------------------------------------
     Frames on display: one instanced mesh per archetype part and material
     ------------------------------------------------------------------ */
  const FM = frameMaterials();
  const groups = new Map();
  const records = [];
  const jit = rng(99);
  function addDisplay(pid, ci, slot, zone) {
    const p = NY.byId[pid];
    if (!p) return null;
    const G = archGeo(p.arch),
      col = NY.colorOf(p, ci);
    const scale = frameScale(p);
    const yLift = -G.minY * scale + 0.0015;
    const ry = slot.ry + (jit() - 0.5) * 0.06;
    const center = new V3(slot.pos.x, slot.pos.y + yLift, slot.pos.z);
    const quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.05, ry, 0, 'YXZ'));
    const base = new THREE.Matrix4().compose(center, quat, new V3(scale, scale, scale));
    const rec = { pid, ci: ci % p.colors.length, center, ry, refs: [], zone, kind: 'frame' };
    for (const pt of partsFor(p, col)) {
      const key = p.arch + '|' + pt.part + '|' + pt.kind;
      let g = groups.get(key);
      if (!g) {
        g = { geo: G[pt.part], mat: FM[pt.kind], items: [] };
        groups.set(key, g);
      }
      g.items.push({ rec, color: pt.color, base });
    }
    records.push(rec);
    return rec;
  }
  const place = (slots, list, zone) =>
    slots.forEach((s, i) => {
      const it = list[i];
      if (it) addDisplay(it[0], it[1], s, zone);
    });
  {
    const MR = NY.MERCH,
      S = built.slots;
    place(S.women.flat(), MR.women, 'women');
    place(S.men.flat(), MR.men, 'men');
    place(S.sunA, MR.sunA, 'sun');
    place(S.sunB, MR.sunB, 'sun');
    place(S.atelier.flat(), MR.atelier, 'atelier');
    place(S.plinths, MR.plinths, 'atelier');
    place(S.kids, MR.kids, 'kids');
  }
  const productMeshes = [];
  for (const g of groups.values()) {
    const im = new THREE.InstancedMesh(g.geo, g.mat, g.items.length);
    im.userData.recs = [];
    g.items.forEach((it, i) => {
      im.setMatrixAt(i, it.base);
      im.setColorAt(i, it.color);
      im.userData.recs[i] = it.rec;
      it.rec.refs.push({ im, i, base: it.base });
    });
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.computeBoundingSphere();
    if (g.mat.transparent) im.renderOrder = 2;
    scene.add(im);
    productMeshes.push(im);
  }

  // Contact lenses and care on the counter's travertine riser: boxes, bottles and cases
  {
    const boxGeo = new THREE.BoxGeometry(0.1, 0.062, 0.034);
    boxGeo.translate(0, 0.031, 0);
    const bottleProfile = [
      [0, 0],
      [0.032, 0],
      [0.034, 0.006],
      [0.034, 0.13],
      [0.026, 0.15],
      [0.012, 0.158],
      [0.012, 0.178],
      [0, 0.178],
    ].map((q) => new THREE.Vector2(q[0], q[1]));
    const bottleGeo = new THREE.LatheGeometry(bottleProfile, 18);
    const smallGeo = bottleGeo.clone();
    smallGeo.scale(0.62, 0.62, 0.62);
    const caseGeo = new THREE.BoxGeometry(0.08, 0.03, 0.05);
    caseGeo.translate(0, 0.015, 0);
    const kinds = {
      box: { geo: boxGeo, mat: std({ map: tex.box, roughness: 0.55 }), items: [] },
      bottle: { geo: bottleGeo, mat: std({ color: 0xffffff, roughness: 0.3 }), items: [] },
      small: { geo: smallGeo, mat: std({ color: 0xffffff, roughness: 0.3 }), items: [] },
      case: { geo: caseGeo, mat: std({ color: 0xffffff, roughness: 0.5 }), items: [] },
    };
    function cluster(pid, base, ry) {
      const p = NY.byId[pid];
      if (!p) return;
      const kind = p.type === 'contacts' ? 'box' : pid === 'c05' ? 'bottle' : pid === 'c06' ? 'small' : 'case';
      const rx = new V3(Math.cos(ry), 0, -Math.sin(ry)),
        fz = new V3(Math.sin(ry), 0, Math.cos(ry));
      const quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0));
      const rec = {
        pid,
        ci: 0,
        center: base.clone().add(new V3(0, 0.06, 0)),
        ry,
        refs: [],
        zone: 'counter',
        kind: 'contacts',
      };
      const color = new THREE.Color(p.color);
      const spots = [];
      if (kind === 'box') {
        for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) spots.push([(i - 0.5) * 0.106, j * 0.064, 0]);
      } else if (kind === 'bottle') {
        for (let i = 0; i < 3; i++) spots.push([(i - 1) * 0.078, 0, 0]);
      } else if (kind === 'small') {
        for (let i = 0; i < 4; i++) spots.push([(i - 1.5) * 0.052, 0, 0]);
      } else {
        for (let j = 0; j < 2; j++) for (let i = 0; i < 3; i++) spots.push([(i - 1) * 0.088, j * 0.032, 0]);
      }
      for (const sp of spots) {
        const pos = base
          .clone()
          .addScaledVector(rx, sp[0])
          .add(new V3(0, sp[1], 0))
          .addScaledVector(fz, sp[2]);
        const m = new THREE.Matrix4().compose(pos, quat, new V3(1, 1, 1));
        kinds[kind].items.push({ rec, color, base: m });
      }
      records.push(rec);
    }
    NY.MERCH.contacts[0].forEach((pid, i) => {
      const s = built.contacts.upper[i];
      if (s) cluster(pid, s.pos, s.ry);
    });
    NY.MERCH.contacts[1].forEach((pid, i) => {
      const s = built.contacts.lower[i];
      if (s) cluster(pid, s.pos, s.ry);
    });
    for (const k of Object.values(kinds)) {
      if (!k.items.length) continue;
      const im = new THREE.InstancedMesh(k.geo, k.mat, k.items.length);
      im.userData.recs = [];
      k.items.forEach((it, i) => {
        im.setMatrixAt(i, it.base);
        im.setColorAt(i, it.color);
        im.userData.recs[i] = it.rec;
        it.rec.refs.push({ im, i, base: it.base });
      });
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.computeBoundingSphere();
      im.castShadow = true;
      scene.add(im);
      productMeshes.push(im);
    }
  }

  /* ------------------------------------------------------------------
     Lighting: soft daylight from the glass front, a warm sky fill, studio reflections
     ------------------------------------------------------------------ */
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  scene.environmentIntensity = 0.5;
  scene.add(new THREE.HemisphereLight(0xfff8f0, 0xb7a994, 0.85));
  const key = new THREE.DirectionalLight(0xfff3e4, 1.15);
  key.position.set(-3.5, 10, 6.5);
  key.target.position.set(0, 0, -0.5);
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -8.5, right: 8.5, top: 8.5, bottom: -8.5, near: 1, far: 26 });
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.025;
  key.shadow.radius = 3;
  scene.add(key, key.target);
  // mirrors: a one-off capture of the salon, so the round mirrors reflect the room
  function captureMirrors() {
    try {
      const rt = new THREE.WebGLCubeRenderTarget(coarse ? 256 : 512, { type: THREE.HalfFloatType });
      const cc = new THREE.CubeCamera(0.05, 40, rt);
      cc.position.set(-1.2, 1.45, 0.4);
      scene.add(cc);
      cc.update(renderer, scene);
      scene.remove(cc);
      M.mirror.envMap = rt.texture;
      M.mirror.envMapIntensity = 1;
      M.mirror.needsUpdate = true;
    } catch (e) {
      console.warn(e);
    }
  }

  /* ------------------------------------------------------------------
     Walk planner: grid, A*, smoothing
     ------------------------------------------------------------------ */
  const NAV = (() => {
    const cell = 0.2,
      R = 0.3,
      cols = Math.round(W / cell),
      rows = Math.round(D / cell),
      blocked = new Uint8Array(cols * rows);
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const x = L.x0 + (c + 0.5) * cell,
          z = L.z0 + (r + 0.5) * cell;
        let b = x < L.x0 + R || x > L.x1 - R || z < L.z0 + R || z > L.z1 - R;
        if (!b)
          for (const o of NY.OBS) {
            if (o.t === 'r') {
              if (x > o.x0 - R && x < o.x1 + R && z > o.z0 - R && z < o.z1 + R) {
                b = true;
                break;
              }
            } else if (Math.hypot(x - o.x, z - o.z) < o.r + R) {
              b = true;
              break;
            }
          }
        blocked[r * cols + c] = b ? 1 : 0;
      }
    return { cell, cols, rows, blocked };
  })();
  const cellOf = (x, z) => [Math.floor((x - L.x0) / NAV.cell), Math.floor((z - L.z0) / NAV.cell)];
  const free = (c, r) => c >= 0 && r >= 0 && c < NAV.cols && r < NAV.rows && !NAV.blocked[r * NAV.cols + c];
  const freeAt = (x, z) => {
    const q = cellOf(x, z);
    return free(q[0], q[1]);
  };
  const centerOf = (c, r) => new V2(L.x0 + (c + 0.5) * NAV.cell, L.z0 + (r + 0.5) * NAV.cell);
  function nearestFree(x, z) {
    if (freeAt(x, z)) return new V2(x, z);
    const [c0, r0] = cellOf(x, z);
    for (let rad = 1; rad < 50; rad++) {
      let best = null,
        bd = 1e9;
      for (let dr = -rad; dr <= rad; dr++)
        for (let dc = -rad; dc <= rad; dc++) {
          if (Math.max(Math.abs(dr), Math.abs(dc)) !== rad) continue;
          if (free(c0 + dc, r0 + dr)) {
            const p = centerOf(c0 + dc, r0 + dr),
              d = (p.x - x) ** 2 + (p.y - z) ** 2;
            if (d < bd) {
              bd = d;
              best = p;
            }
          }
        }
      if (best) return best;
    }
    return null;
  }
  function los(a, b) {
    const d = a.distanceTo(b),
      n = Math.ceil(d / 0.07);
    for (let i = 1; i < n; i++) {
      const t = i / n;
      if (!freeAt(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t)) return false;
    }
    return true;
  }
  function findPath(a, b) {
    const { cols, rows } = NAV;
    let s = cellOf(a.x, a.y);
    if (!free(s[0], s[1])) {
      const n = nearestFree(a.x, a.y);
      if (!n) return null;
      s = cellOf(n.x, n.y);
    }
    const e = cellOf(b.x, b.y);
    if (!free(e[0], e[1])) return null;
    const N = cols * rows,
      g = new Float32Array(N).fill(Infinity),
      came = new Int32Array(N).fill(-1),
      closed = new Uint8Array(N);
    const start = s[1] * cols + s[0],
      goal = e[1] * cols + e[0];
    const hf = [],
      hi = [];
    const push = (f, i) => {
      hf.push(f);
      hi.push(i);
      let k = hf.length - 1;
      while (k > 0) {
        const p = (k - 1) >> 1;
        if (hf[p] <= hf[k]) break;
        [hf[p], hf[k]] = [hf[k], hf[p]];
        [hi[p], hi[k]] = [hi[k], hi[p]];
        k = p;
      }
    };
    const pop = () => {
      const top = hi[0],
        lf = hf.pop(),
        li = hi.pop();
      if (hf.length) {
        hf[0] = lf;
        hi[0] = li;
        let k = 0;
        for (;;) {
          const l = 2 * k + 1,
            r = l + 1;
          let m = k;
          if (l < hf.length && hf[l] < hf[m]) m = l;
          if (r < hf.length && hf[r] < hf[m]) m = r;
          if (m === k) break;
          [hf[m], hf[k]] = [hf[k], hf[m]];
          [hi[m], hi[k]] = [hi[k], hi[m]];
          k = m;
        }
      }
      return top;
    };
    const heur = (c, r) => {
      const dx = Math.abs(c - e[0]),
        dy = Math.abs(r - e[1]);
      return dx + dy + (Math.SQRT2 - 2) * Math.min(dx, dy);
    };
    const DIRS = [
      [1, 0, 1],
      [-1, 0, 1],
      [0, 1, 1],
      [0, -1, 1],
      [1, 1, Math.SQRT2],
      [1, -1, Math.SQRT2],
      [-1, 1, Math.SQRT2],
      [-1, -1, Math.SQRT2],
    ];
    g[start] = 0;
    push(heur(s[0], s[1]), start);
    while (hf.length) {
      const cur = pop();
      if (cur === goal) break;
      if (closed[cur]) continue;
      closed[cur] = 1;
      const cr = (cur / cols) | 0,
        cc = cur - cr * cols;
      for (const [dc, dr, w] of DIRS) {
        const nc = cc + dc,
          nr = cr + dr;
        if (!free(nc, nr)) continue;
        if (dc && dr && (!free(cc + dc, cr) || !free(cc, cr + dr))) continue;
        const ni = nr * cols + nc,
          ng = g[cur] + w;
        if (ng < g[ni]) {
          g[ni] = ng;
          came[ni] = cur;
          push(ng + heur(nc, nr), ni);
        }
      }
    }
    if (g[goal] === Infinity) return null;
    const cells = [];
    for (let i = goal; i !== -1; i = came[i]) cells.push(i);
    cells.reverse();
    const pts = cells.map((i) => centerOf(i % cols, (i / cols) | 0));
    pts[0] = new V2(a.x, a.y);
    pts[pts.length - 1] = new V2(b.x, b.y);
    if (pts.length < 3) return pts;
    const out = [pts[0]];
    let i = 0;
    while (i < pts.length - 1) {
      let j = pts.length - 1;
      while (j > i + 1 && !los(pts[i], pts[j])) j--;
      out.push(pts[j]);
      i = j;
    }
    return out;
  }

  /* ------------------------------------------------------------------
     Camera movement
     ------------------------------------------------------------------ */
  const nav = {
    x: NY.START.x,
    z: NY.START.z,
    yaw: NY.START.yaw,
    pitch: NY.START.pitch,
    moving: false,
    pts: null,
    cum: null,
    len: 0,
    t: 0,
    T: 1,
    s: 0,
    look: null,
    info: null,
    turn: null,
  };
  let zoom = 1,
    baseFov = 60,
    needs = true,
    keepAlive = 0,
    paused = false,
    labelsOn = true;
  let curZone = (NY.zoneAt(nav.x, nav.z) || {}).id || null;
  const kick = (ms) => {
    keepAlive = Math.max(keepAlive, performance.now() + (ms || 400));
  };
  const angDiff = (a, b) => {
    let d = a - b;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  };
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth01 = (t) => {
    t = Math.max(0, Math.min(1, t));
    return t * t * (3 - 2 * t);
  };
  function yawPitch(fx, fz, t) {
    const dx = t.x - fx,
      dz = t.z - fz,
      dy = t.y - EYE;
    return { yaw: Math.atan2(-dx, -dz), pitch: Math.max(-0.9, Math.min(0.6, Math.atan2(dy, Math.hypot(dx, dz)))) };
  }

  const ringMat = basic({ color: '#1f2b45', transparent: true, opacity: 0.7, depthWrite: false, toneMapped: false });
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.17, 0.215, 48).rotateX(-Math.PI / 2), ringMat);
  ring.visible = false;
  ring.renderOrder = 4;
  scene.add(ring);
  const dest = new THREE.Mesh(
    new THREE.RingGeometry(0.08, 0.24, 48).rotateX(-Math.PI / 2),
    basic({ color: '#1f2b45', transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false }),
  );
  dest.visible = false;
  dest.renderOrder = 4;
  scene.add(dest);
  const fadeEl = document.getElementById('fade');

  function updateZone(force) {
    const z = NY.zoneAt(nav.x, nav.z),
      id = z ? z.id : null;
    if (id !== curZone) {
      curZone = id;
      if (NY.onZoneChange) NY.onZoneChange(id);
    } else if (force && NY.onZoneChange) NY.onZoneChange(id);
  }
  function arrive() {
    nav.moving = false;
    dest.visible = false;
    const info = nav.info || {};
    nav.info = null;
    updateZone(false);
    if (info.reason === 'product' && info.rec) highlight(info.rec);
    if (NY.onArrive) NY.onArrive({ zone: curZone, reason: info.reason, id: info.id, tag: info.tag });
    kick(700);
  }
  function teleport(end, look) {
    nav.moving = false;
    fadeEl.classList.add('on');
    setTimeout(
      () => {
        nav.x = end.x;
        nav.z = end.y;
        if (look) {
          nav.yaw = look.yaw;
          nav.pitch = look.pitch;
        }
        nav.turn = null;
        needs = true;
        kick();
        requestAnimationFrame(() => {
          fadeEl.classList.remove('on');
          arrive();
        });
      },
      RM ? 60 : 220,
    );
    return true;
  }
  function goTo(x, z, look, info) {
    let end = nearestFree(x, z);
    if (!end) return false;
    let pts = findPath(new V2(nav.x, nav.z), end);
    if (!pts) {
      if (NY.toast) NY.toast('That spot can’t be reached from here.');
      return false;
    }
    if (info && info.clear && !look) {
      pts = keepClear(pts);
      end = pts[pts.length - 1];
    }
    nav.info = info || { reason: 'point' };
    const endLook = look ? yawPitch(end.x, end.y, look) : null;
    if (NY.settings && NY.settings.move === 'jump') return teleport(end, endLook);
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + pts[i].distanceTo(pts[i - 1]));
    const len = cum[cum.length - 1];
    if (len < 0.08) {
      nav.turn = endLook;
      arrive();
      return true;
    }
    Object.assign(nav, {
      moving: true,
      pts,
      cum,
      len,
      t: 0,
      s: 0,
      T: Math.min(4.6, Math.max(0.7, len / 2.3)),
      look: endLook,
      turn: null,
    });
    dest.position.set(end.x, 0.012, end.y);
    dest.visible = true;
    ring.visible = false;
    kick();
    return true;
  }
  function pointAt(s) {
    const { pts, cum } = nav;
    for (let i = 1; i < pts.length; i++)
      if (s <= cum[i]) {
        const t = (s - cum[i - 1]) / (cum[i] - cum[i - 1] || 1);
        return new V2(lerp(pts[i - 1].x, pts[i].x, t), lerp(pts[i - 1].y, pts[i].y, t));
      }
    return pts[pts.length - 1].clone();
  }

  /* ------------------------------------------------------------------
     Where to stand: square in front of a tapped poster, niche or wall, far enough back to see it whole,
     and never with the face against a wall after a floor tap
     ------------------------------------------------------------------ */
  const CLEAR = 0.95; // metres kept between the eye and a wall straight ahead after a floor tap
  const NEAR = 1.35; // closest stand-off in front of a tapped surface
  const FAR = 2.6; // furthest stand-off (wide pieces on a narrow phone screen)
  const FOCUS = (() => {
    const f = [];
    // c: centre of what to frame, on its front face; n: its facing direction; w, h: what to fit in view;
    // hw, y, dep: the box around it that counts as a tap on it (half-width, height range, depth range along n)
    const add = (x, y, z, ry, w, h, hw, yr, dep) =>
      f.push({ c: new V3(x, y, z), n: new V2(Math.sin(ry), Math.cos(ry)), w, h, hw, yr, dep });
    for (const p of L.posters) {
      const s = Math.sin(p.ry) * 0.047,
        c = Math.cos(p.ry) * 0.047;
      add(
        p.x + s,
        p.y,
        p.z + c,
        p.ry,
        p.w + 0.06,
        p.h + 0.06,
        p.w / 2 + 0.06,
        [p.y - p.h / 2 - 0.06, p.y + p.h / 2 + 0.06],
        [-0.12, 0.1],
      );
    }
    const N = L.niches,
      sh = L.nicheShelves,
      ny = (sh[0] + sh[sh.length - 1]) / 2 + 0.06;
    for (const z of N.zs)
      add(
        L.x1 - L.wall,
        ny,
        z,
        -Math.PI / 2,
        N.w,
        sh[sh.length - 1] - sh[0] + 0.2,
        N.w / 2 + 0.06,
        [N.y0 - 0.05, N.y1 + 0.05],
        [-N.depth - 0.1, 0.06],
      );
    const K = L.kids;
    add(
      L.x0 + L.wall,
      (K.y0 + K.y1) / 2,
      K.z,
      Math.PI / 2,
      K.w,
      K.y1 - K.y0,
      K.w / 2 + 0.08,
      [K.y0 - 0.05, K.y1 + 0.05],
      [-0.4, 0.06],
    );
    const Hc = L.hutch,
      hy0 = Hc.h,
      hy1 = Hc.panel[1];
    add(
      Hc.x,
      (hy0 + hy1) / 2,
      L.z0 + 0.15,
      0,
      Hc.w,
      hy1 - hy0 + 0.1,
      Hc.w / 2 + 0.05,
      [0, hy1 + 0.1],
      [-0.2, Hc.d + 0.05],
    );
    for (const m of L.mirrors) if (!m.tryon) add(m.x, 1.42, m.z, m.ry, 0.8, 0.8, 0.42, [0, 1.85], [-0.12, 0.12]);
    return f;
  })();
  /* The top bar and the section card cover the top ~8% and bottom ~24% of the view, so a focused piece is fitted
     into the open band between them (about two thirds of the height) and centred on it, 42% from the top. */
  const BAND = 0.66,
    BAND_MID = 0.42;
  /** Distance at which a w x h piece fills the open band of the view. */
  function fitDist(w, h) {
    const vt = Math.tan((baseFov * Math.PI) / 360),
      ht = vt * Math.max(0.3, camera.aspect);
    return Math.min(FAR, Math.max(NEAR, h / 2 / vt / BAND, w / 2 / ht / 0.8));
  }
  /** Lowers the look point so that `look`, seen from `at`, sits in the middle of the open band. */
  function bandLook(at, look) {
    const k = ((0.5 - BAND_MID) / 0.5) * Math.tan((baseFov * Math.PI) / 360);
    const out = look.clone();
    out.y -= Math.hypot(look.x - at.x, look.z - at.y) * k;
    return out;
  }
  function focusFor(hit) {
    const p = hit.point;
    const toCam = new V2(nav.x - p.x, nav.z - p.z);
    for (const t of FOCUS) {
      const dx = p.x - t.c.x,
        dz = p.z - t.c.z;
      const lat = -dx * t.n.y + dz * t.n.x,
        dep = dx * t.n.x + dz * t.n.y;
      if (Math.abs(lat) > t.hw || p.y < t.yr[0] || p.y > t.yr[1] || dep < t.dep[0] || dep > t.dep[1]) continue;
      const n = t.n.clone();
      if ((nav.x - t.c.x) * n.x + (nav.z - t.c.z) * n.y < 0) n.negate(); // free-standing piece seen from behind
      return { c: t.c, n, d: fitDist(t.w, t.h), look: t.c.clone() };
    }
    // anything else: stand square to the surface that was tapped
    let n = null;
    if (hit.face) {
      const wn = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
      n = new V2(wn.x, wn.z);
    }
    if (!n || n.length() < 0.35) n = toCam.clone(); // a top surface: come at it from this side
    if (n.lengthSq() < 1e-6) n.set(0, 1);
    n.normalize();
    if (n.dot(toCam) < 0) n.negate();
    return { c: p.clone(), n, d: Math.max(NEAR, 1.45), look: p.clone() };
  }
  /** A free, reachable spot on the line out from c along n, as close to distance d as the room allows. */
  function standIn(c, n, d) {
    const from = new V2(nav.x, nav.z);
    const toCam = new V2(nav.x - c.x, nav.z - c.z);
    const dirs = [n];
    if (toCam.lengthSq() > 1e-6) {
      toCam.normalize();
      if (toCam.dot(n) < 0.97) dirs.push(toCam); // a recess or a side face: also try from where the visitor is
    }
    const ts = [];
    for (let t = d; t <= d + 1.8 + 1e-6; t += 0.1) ts.push(t);
    for (let t = d - 0.1; t >= 0.95 - 1e-6; t -= 0.1) ts.push(t);
    /* Room ahead: the visitor could still step 0.3 and 0.6 m towards the spot, so nothing solid is within about
       0.9 m of the eye in the middle of the view (the walk grid keeps BODY_R from every solid). */
    const roomAhead = (at) => {
      const dx = c.x - at.x,
        dz = c.z - at.y,
        L = Math.hypot(dx, dz);
      for (const s of [0.3, 0.6]) if (s < L - 0.3 && !freeAt(at.x + (dx / L) * s, at.y + (dz / L) * s)) return false;
      return true;
    };
    for (const strict of [true, false])
      for (const dir of dirs) {
        const side = new V2(-dir.y, dir.x);
        for (const t of ts)
          for (const s of [0, 0.15, -0.15, 0.3, -0.3]) {
            const x = c.x + dir.x * t + side.x * s,
              z = c.z + dir.y * t + side.y * s;
            if (!freeAt(x, z)) continue;
            const at = new V2(x, z);
            if (strict && !roomAhead(at)) continue;
            if (at.distanceTo(from) < 0.08 || findPath(from, at)) return at;
          }
      }
    return null;
  }
  const fwd = new THREE.Raycaster();
  /** Shortens a floor-tap walk so the visitor stops CLEAR metres short of a wall or fixture straight ahead. */
  function keepClear(pts) {
    const n = pts.length;
    if (n < 2) return pts;
    const a = pts[n - 2],
      b = pts[n - 1];
    const dir = new V2(b.x - a.x, b.y - a.y),
      seg = dir.length();
    if (seg < 0.05) return pts;
    dir.divideScalar(seg);
    fwd.set(new V3(b.x, EYE, b.y), new V3(dir.x, 0, dir.y));
    fwd.far = CLEAR;
    const h = fwd.intersectObjects(solids, false)[0];
    if (!h) return pts;
    let total = 0;
    for (let i = 1; i < n; i++) total += pts[i].distanceTo(pts[i - 1]);
    let back = Math.min(CLEAR - h.distance, total * 0.85);
    if (back < 0.03) return pts;
    const out = pts.slice();
    while (back > 1e-4 && out.length > 1) {
      const q = out[out.length - 1],
        p = out[out.length - 2],
        l = q.distanceTo(p);
      if (l > back) {
        out[out.length - 1] = new V2(q.x + ((p.x - q.x) * back) / l, q.y + ((p.y - q.y) * back) / l);
        back = 0;
      } else {
        out.pop();
        back -= l;
      }
    }
    return out;
  }

  /* ------------------------------------------------------------------
     Input: drag to look, tap to walk or open, pinch and wheel to zoom, keys
     ------------------------------------------------------------------ */
  const ray = new THREE.Raycaster(),
    ndc = new V2();
  const pickables = productMeshes.concat(hitboxes);
  const allHits = pickables.concat(solids, [floor]);
  function setRay(cx, cy) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
  }
  const ptrs = new Map();
  const drag = { active: false, id: null, x: 0, y: 0, sx: 0, sy: 0, t: 0, moved: false };
  let pinch = null;
  const pdist = () => {
    const v = [...ptrs.values()];
    return Math.hypot(v[0].x - v[1].x, v[0].y - v[1].y);
  };
  canvas.addEventListener('pointerdown', (e) => {
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch (err) {
      /* ignore */
    }
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.size === 1)
      Object.assign(drag, {
        active: true,
        id: e.pointerId,
        x: e.clientX,
        y: e.clientY,
        sx: e.clientX,
        sy: e.clientY,
        t: performance.now(),
        moved: false,
      });
    else if (ptrs.size === 2) {
      drag.active = false;
      pinch = { d: pdist(), z: zoom };
    }
    if (NY.onUserNav) NY.onUserNav('down');
    kick();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && ptrs.size === 2) {
      zoom = Math.max(0.45, Math.min(1.15, (pinch.z * pinch.d) / Math.max(10, pdist())));
      kick();
      return;
    }
    if (drag.active && e.pointerId === drag.id) {
      const dx = e.clientX - drag.x,
        dy = e.clientY - drag.y;
      drag.x = e.clientX;
      drag.y = e.clientY;
      if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 6) {
        drag.moved = true;
        canvas.classList.add('grabbing');
        nav.turn = null;
        hideTip();
      }
      if (drag.moved) {
        const k = (camera.fov * Math.PI) / 180 / Math.max(200, canvas.clientHeight);
        nav.yaw += dx * k;
        nav.pitch = Math.max(-0.95, Math.min(0.7, nav.pitch + dy * k));
        kick();
      }
      return;
    }
    if (e.pointerType === 'mouse' && !drag.active) {
      hoverPt = [e.clientX, e.clientY];
      if (!hoverReq) hoverReq = requestAnimationFrame(doHover);
    }
  });
  function endPtr(e) {
    const wasPinch = !!pinch;
    ptrs.delete(e.pointerId);
    if (pinch && ptrs.size < 2) {
      pinch = null;
      drag.active = false;
    }
    if (drag.active && e.pointerId === drag.id) {
      if (!drag.moved && !wasPinch && e.type === 'pointerup' && performance.now() - drag.t < 650) {
        tap(e.clientX, e.clientY, e.pointerType);
        // Opening a sheet can take a while on a slow phone; the browser's click for this tap arrives only after that.
        if (NY.lastSceneTap) NY.lastSceneTap.t = performance.now();
      }
      drag.active = false;
      canvas.classList.remove('grabbing');
    }
    kick();
  }
  canvas.addEventListener('pointerup', endPtr);
  canvas.addEventListener('pointercancel', endPtr);
  canvas.addEventListener('pointerleave', () => {
    if (!drag.active) {
      setHover(null);
      hideTip();
      ring.visible = false;
      kick();
    }
  });
  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      zoom = Math.max(0.45, Math.min(1.15, zoom * Math.exp(e.deltaY * 0.0012)));
      kick();
    },
    { passive: false },
  );
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  // A fingertip covers several pixels and many pieces are small or thin: a touch that just misses a piece still opens
  // the nearest one within this many CSS px, unless that piece is behind what the touch hit.
  const TOUCH_PICK_PX = 34;
  function nearRec(cx, cy, hitDist) {
    const r = canvas.getBoundingClientRect();
    const q = new V3();
    let best = null,
      bestPx = TOUCH_PICK_PX;
    for (const rec of records) {
      const d = camera.position.distanceTo(rec.center);
      if (d > 7 || d > hitDist + 0.35) continue;
      q.copy(rec.center).project(camera);
      if (q.z < -1 || q.z > 1) continue;
      const px = Math.hypot(r.left + ((q.x + 1) / 2) * r.width - cx, r.top + ((1 - q.y) / 2) * r.height - cy);
      if (px < bestPx) {
        bestPx = px;
        best = rec;
      }
    }
    return best;
  }
  function tap(cx, cy, type) {
    // The browser sends a click at this point right after the pointerup; the interface swallows it (see app.js).
    NY.lastSceneTap = { x: cx, y: cy, t: performance.now() };
    setRay(cx, cy);
    const hit = ray.intersectObjects(allHits, false)[0];
    const near =
      type === 'touch' && !(hit && hit.object.userData.recs) ? nearRec(cx, cy, hit ? hit.distance : Infinity) : null;
    if (!hit && !near) return;
    const o = hit ? hit.object : { userData: {} };
    if (near || o.userData.recs) {
      const rec = near || o.userData.recs[hit.instanceId];
      if (rec && NY.onProductTap) {
        nav.turn = yawPitch(nav.x, nav.z, rec.center);
        kick();
        NY.onProductTap(rec.pid, rec.ci);
      }
      return;
    }
    if (o.userData.action) {
      if (NY.onFeatureTap) NY.onFeatureTap(o.userData.action);
      return;
    }
    if (NY.onUserNav) NY.onUserNav('walk');
    if (o !== floor && hit.point.y > 0.05) {
      // a poster, niche, wall or fixture: walk to a spot square in front of it and look at it
      const f = focusFor(hit);
      const at = standIn(f.c, f.n, f.d);
      if (at) {
        goTo(at.x, at.y, bandLook(at, f.look), { reason: 'point' });
        return;
      }
      const dx = nav.x - hit.point.x,
        dz = nav.z - hit.point.z,
        d = Math.hypot(dx, dz) || 1;
      const at2 = new V2(hit.point.x + (dx / d) * NEAR, hit.point.z + (dz / d) * NEAR);
      goTo(at2.x, at2.y, bandLook(at2, hit.point), { reason: 'point' });
      return;
    }
    goTo(hit.point.x, hit.point.z, null, { reason: 'point', clear: true });
  }

  let hoverReq = null,
    hoverPt = null,
    hovered = null;
  const tipEl = document.getElementById('tooltip');
  const appEl = document.getElementById('app');
  const esc = (s) =>
    String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const FEATURE_TIPS = {
    directory: '<b>Store directory</b>Click to open the map',
    lensguide: '<b>Lens bar</b>Click for the lens guide',
    tryon: '<b>Try-on mirror</b>Click to try frames on with your camera',
    bag: '<b>Checkout</b>Click to open your bag',
  };
  function tipFor(rec) {
    const p = NY.byId[rec.pid];
    if (p.type !== 'frame') return '<b>' + esc(p.name) + '</b>from ' + NY.money(Math.min(...p.packs.map((x) => x.p)));
    return '<b>' + esc(p.name) + '</b>' + esc(NY.colorOf(p, rec.ci).n) + ' · ' + NY.money(p.price);
  }
  function showTip(cx, cy, html) {
    const r = appEl.getBoundingClientRect();
    tipEl.innerHTML = html;
    tipEl.hidden = false;
    const x = Math.min(cx - r.left, r.width - 240),
      y = Math.min(cy - r.top, r.height - 70);
    tipEl.style.transform = 'translate(' + (x + 14) + 'px,' + (y + 14) + 'px)';
  }
  function hideTip() {
    tipEl.hidden = true;
  }
  function setPose(rec, k) {
    const s = 1 + 0.14 * k;
    const ox = Math.sin(rec.ry) * 0.025 * k,
      oz = Math.cos(rec.ry) * 0.025 * k,
      oy = 0.012 * k;
    for (const r of rec.refs) {
      const m = r.base.clone();
      if (k) {
        m.scale(new V3(s, s, s));
        m.elements[12] += ox;
        m.elements[13] += oy;
        m.elements[14] += oz;
      }
      r.im.setMatrixAt(r.i, m);
      r.im.instanceMatrix.needsUpdate = true;
    }
  }
  function setHover(rec) {
    if (rec === hovered) return;
    if (hovered && !(pulse && pulse.rec === hovered)) setPose(hovered, 0);
    hovered = rec;
    if (rec) setPose(rec, 1);
    needs = true;
  }
  function doHover() {
    hoverReq = null;
    if (!hoverPt || drag.active) return;
    const [cx, cy] = hoverPt;
    setRay(cx, cy);
    let hit = ray.intersectObjects(pickables, false)[0];
    if (hit) {
      const occ = ray.intersectObjects(solids, false)[0];
      if (occ && occ.distance < hit.distance - 0.03) hit = null;
    }
    const rec = hit && hit.object.userData.recs ? hit.object.userData.recs[hit.instanceId] : null;
    const feat = hit && hit.object.userData.action ? hit.object.userData.action : null;
    setHover(rec);
    if (rec || feat) {
      showTip(cx, cy, rec ? tipFor(rec) : FEATURE_TIPS[feat]);
      canvas.classList.add('over-item');
      ring.visible = false;
    } else {
      hideTip();
      canvas.classList.remove('over-item');
      const o = ray.ray.origin,
        d = ray.ray.direction;
      ring.visible = false;
      if (d.y < -0.01 && !nav.moving) {
        const t = -o.y / d.y,
          x = o.x + d.x * t,
          z = o.z + d.z * t;
        if (t < 30 && freeAt(x, z)) {
          ring.position.set(x, 0.012, z);
          ring.visible = true;
        }
      }
    }
    kick(150);
  }

  const keys = new Set();
  const MOVE_KEYS = ['w', 'a', 's', 'd', 'q', 'e', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'];
  const typing = (e) => {
    const t = e.target;
    return (
      t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || (t.closest && t.closest('#sheet')))
    );
  };
  window.addEventListener('keydown', (e) => {
    if (typing(e) || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (!MOVE_KEYS.includes(k)) return;
    e.preventDefault();
    keys.add(k);
    nav.moving = false;
    nav.turn = null;
    dest.visible = false;
    if (NY.onUserNav) NY.onUserNav('keys');
    kick();
  });
  window.addEventListener('keyup', (e) => {
    keys.delete(e.key.toLowerCase());
  });
  window.addEventListener('blur', () => keys.clear());
  let walked = false,
    walkedAt = 0;

  /* ------------------------------------------------------------------
     Highlight for "Show in store"
     ------------------------------------------------------------------ */
  let pulse = null;
  const pinEl = document.getElementById('pin'),
    pinLabel = document.getElementById('pin-label');
  function highlight(rec) {
    if (pulse) setPose(pulse.rec, 0);
    pulse = { rec, until: performance.now() + 6500 };
    const p = NY.byId[rec.pid];
    pinLabel.textContent = p.name + (p.type === 'frame' ? ' · ' + NY.colorOf(p, rec.ci).n : '');
    pinEl.hidden = false;
    kick(6600);
  }
  const tmpV = new V3();
  function updatePin() {
    if (!pulse) {
      pinEl.hidden = true;
      return;
    }
    tmpV.copy(pulse.rec.center);
    tmpV.y += 0.07;
    const v = tmpV.project(camera);
    if (v.z > 1 || Math.abs(v.x) > 1.1 || Math.abs(v.y) > 1.1) {
      pinEl.style.opacity = '0';
      return;
    }
    const r = canvas.getBoundingClientRect();
    pinEl.style.opacity = '1';
    pinEl.style.transform =
      'translate3d(' +
      (((v.x + 1) / 2) * r.width).toFixed(1) +
      'px,' +
      (((1 - v.y) / 2) * r.height).toFixed(1) +
      'px,0) translate(-50%,-100%)';
  }

  /* ------------------------------------------------------------------
     Floating section labels
     ------------------------------------------------------------------ */
  const labelsEl = document.getElementById('labels');
  const labels = NY.ZONES.map((z) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'zlabel';
    b.hidden = true;
    b.innerHTML = '<i aria-hidden="true"></i><span>' + esc(z.short) + '</span>';
    b.setAttribute('aria-label', 'Walk to ' + z.name);
    b.addEventListener('click', () => {
      if (NY.onUserNav) NY.onUserNav('label');
      goTo(z.view.p[0], z.view.p[1], new V3(z.view.t[0], z.view.t[1], z.view.t[2]), { reason: 'zone', id: z.id });
    });
    labelsEl.appendChild(b);
    return { z, el: b, p: new V3(z.anchor[0], z.anchor[1], z.anchor[2]) };
  });
  function updateLabels() {
    const r = canvas.getBoundingClientRect();
    const hideAll = !labelsOn || paused;
    for (const lb of labels) {
      if (hideAll || lb.z.id === curZone) {
        lb.el.hidden = true;
        continue;
      }
      const d = Math.hypot(lb.p.x - nav.x, lb.p.z - nav.z);
      tmpV.copy(lb.p).project(camera);
      if (tmpV.z > 1 || tmpV.z < -1 || Math.abs(tmpV.x) > 1.02 || Math.abs(tmpV.y) > 1.02 || d > 17 || d < 1.6) {
        lb.el.hidden = true;
        continue;
      }
      lb.el.hidden = false;
      lb.el.style.transform =
        'translate3d(' +
        (((tmpV.x + 1) / 2) * r.width).toFixed(1) +
        'px,' +
        (((1 - tmpV.y) / 2) * r.height).toFixed(1) +
        'px,0) translate(-50%,-100%)';
      lb.el.style.opacity = d > 13 ? String(Math.max(0.35, (17 - d) / 4)) : '1';
    }
  }

  /* ------------------------------------------------------------------
     Product viewer (second renderer inside the detail sheet)
     ------------------------------------------------------------------ */
  let VW = null;
  function ensureViewer() {
    if (VW) return VW;
    const r2 = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    r2.outputColorSpace = THREE.SRGBColorSpace;
    r2.toneMapping = THREE.NeutralToneMapping;
    r2.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    r2.setClearColor(0x000000, 0);
    const sc = new THREE.Scene();
    const pm = new THREE.PMREMGenerator(r2);
    sc.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    pm.dispose();
    sc.environmentIntensity = 0.7;
    sc.add(new THREE.HemisphereLight(0xffffff, 0x8f8a80, 0.6));
    const d2 = new THREE.DirectionalLight(0xfff6ec, 1.0);
    d2.position.set(0.3, 0.6, 0.5);
    sc.add(d2);
    const sh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.24, 0.2),
      basic({ map: tex.sRound, color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false }),
    );
    sh.rotation.x = -Math.PI / 2;
    sh.position.set(0, -0.034, -0.05);
    sc.add(sh);
    const cam = new THREE.PerspectiveCamera(28, 1.6, 0.01, 5);
    cam.position.set(0.15, 0.05, 0.28);
    const ctr = new OrbitControls(cam, r2.domElement);
    ctr.target.set(0, -0.004, -0.04);
    ctr.enablePan = false;
    ctr.enableDamping = true;
    ctr.dampingFactor = 0.08;
    ctr.minDistance = 0.16;
    ctr.maxDistance = 0.55;
    ctr.minPolarAngle = 0.45;
    ctr.maxPolarAngle = 2.1;
    ctr.autoRotate = !RM;
    ctr.autoRotateSpeed = 1.6;
    ctr.addEventListener('start', () => {
      ctr.autoRotate = false;
    });
    ctr.update();
    const group = new THREE.Group();
    sc.add(group);
    VW = { r: r2, sc, cam, ctr, group, el: null, active: false, pid: null, mats: [] };
    return VW;
  }
  function buildViewerModel(pid, ci, size) {
    const p = NY.byId[pid];
    for (const c of VW.group.children) if (c.userData.dispose) c.userData.dispose();
    VW.group.clear();
    VW.group.add(frameGroup(p, ci, size || 'M'));
    VW.ci = ci;
    VW.size = size || 'M';
  }
  function sizeViewer() {
    if (!VW || !VW.el) return;
    const r = VW.el.getBoundingClientRect(),
      w = Math.max(1, Math.round(r.width)),
      h = Math.max(1, Math.round(r.height));
    VW.r.setSize(w, h, false);
    VW.cam.aspect = w / h;
    VW.cam.updateProjectionMatrix();
  }
  function mountViewer(el, pid, ci, size) {
    try {
      ensureViewer();
    } catch (e) {
      console.warn(e);
      return false;
    }
    VW.el = el;
    VW.pid = pid;
    VW.r.domElement.className = 'viewer-canvas';
    VW.r.domElement.setAttribute('aria-label', '3D view of the frame. Drag to turn it.');
    el.prepend(VW.r.domElement);
    buildViewerModel(pid, ci, size);
    VW.cam.position.set(0.15, 0.05, 0.28);
    VW.ctr.target.set(0, -0.004, -0.04);
    VW.ctr.autoRotate = !RM;
    VW.ctr.update();
    sizeViewer();
    VW.active = true;
    return true;
  }
  function unmountViewer() {
    if (!VW) return;
    VW.active = false;
    if (VW.r.domElement.parentNode) VW.r.domElement.parentNode.removeChild(VW.r.domElement);
    VW.el = null;
  }

  /* ------------------------------------------------------------------
     Quality, sizing and the frame loop
     ------------------------------------------------------------------ */
  const QUAL = { dpr: 1 };
  function resize() {
    const r = canvas.getBoundingClientRect(),
      w = Math.max(1, Math.round(r.width)),
      h = Math.max(1, Math.round(r.height));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Tall phones held upright get a taller view, so the view is wide enough (about 48° across) to take in a display.
    baseFov = camera.aspect < 0.6 ? 82 : camera.aspect < 0.75 ? 70 : camera.aspect < 1.15 ? 64 : 58;
    needs = true;
    sizeViewer();
  }
  function applyQuality(mode) {
    const dpr = window.devicePixelRatio || 1;
    let max, sh;
    if (mode === 'high') {
      max = 2;
      sh = true;
    } else if (mode === 'low') {
      max = 1;
      sh = false;
    } else {
      max = coarse ? 1.5 : 1.75;
      sh = !coarse;
    }
    QUAL.dpr = Math.min(dpr, max);
    renderer.setPixelRatio(QUAL.dpr);
    if (renderer.shadowMap.enabled !== sh) {
      renderer.shadowMap.enabled = sh;
      key.castShadow = sh;
      scene.traverse((o) => {
        if (o.material)
          (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => {
            m.needsUpdate = true;
          });
      });
    }
    renderer.shadowMap.needsUpdate = true;
    resize();
  }
  let slow = 0;
  function adapt(dt) {
    if (!NY.settings || NY.settings.quality !== 'auto') return;
    if (dt > 1 / 36) slow++;
    else slow = Math.max(0, slow - 1);
    if (slow > 40 && QUAL.dpr > 1) {
      QUAL.dpr = Math.max(1, QUAL.dpr - 0.25);
      renderer.setPixelRatio(QUAL.dpr);
      resize();
      slow = 0;
    }
  }
  function pose() {
    let path = null;
    if (nav.moving && nav.pts) {
      path = [{ x: nav.x, z: nav.z }];
      for (let i = 1; i < nav.pts.length; i++) if (nav.cum[i] > nav.s) path.push({ x: nav.pts[i].x, z: nav.pts[i].y });
    }
    return {
      x: nav.x,
      z: nav.z,
      yaw: nav.yaw,
      hfov: 2 * Math.atan(Math.tan((camera.fov * Math.PI) / 360) * camera.aspect),
      path,
    };
  }
  function update(dt) {
    let act = false;
    if (nav.moving) {
      act = true;
      nav.t += dt;
      const u = Math.min(1, nav.t / nav.T);
      const e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
      nav.s = e * nav.len;
      const p = pointAt(nav.s);
      nav.x = p.x;
      nav.z = p.y;
      if (!drag.moved || !drag.active) {
        const q = pointAt(Math.min(nav.len, nav.s + 0.9));
        let hy = nav.yaw;
        if (q.distanceTo(p) > 0.05) hy = Math.atan2(-(q.x - p.x), -(q.y - p.y));
        const w = nav.look ? smooth01((u - 0.5) / 0.5) : 0;
        const ty = nav.look ? hy + angDiff(nav.look.yaw, hy) * w : hy;
        const tp = nav.look ? lerp(-0.05, nav.look.pitch, w) : -0.05;
        const k = 1 - Math.exp(-dt * 5.5);
        nav.yaw += angDiff(ty, nav.yaw) * k;
        nav.pitch += (tp - nav.pitch) * k;
      }
      updateZone(false);
      if (u >= 1) {
        if (nav.look) nav.turn = nav.look;
        arrive();
      }
    }
    if (nav.turn && !(drag.active && drag.moved)) {
      act = true;
      const k = 1 - Math.exp(-dt * 6);
      const dy = angDiff(nav.turn.yaw, nav.yaw),
        dp = nav.turn.pitch - nav.pitch;
      nav.yaw += dy * k;
      nav.pitch += dp * k;
      if (Math.abs(dy) < 0.002 && Math.abs(dp) < 0.002) nav.turn = null;
    }
    if (keys.size) {
      act = true;
      const f = (keys.has('w') || keys.has('arrowup') ? 1 : 0) - (keys.has('s') || keys.has('arrowdown') ? 1 : 0);
      const st = (keys.has('d') ? 1 : 0) - (keys.has('a') ? 1 : 0);
      const tr = (keys.has('arrowleft') || keys.has('q') ? 1 : 0) - (keys.has('arrowright') || keys.has('e') ? 1 : 0);
      nav.yaw += tr * 1.7 * dt;
      if (f || st) {
        const sp = 2.1 * dt,
          fx = -Math.sin(nav.yaw),
          fz = -Math.cos(nav.yaw),
          rx = Math.cos(nav.yaw),
          rz = -Math.sin(nav.yaw);
        const nx = nav.x + (fx * f + rx * st) * sp,
          nz = nav.z + (fz * f + rz * st) * sp;
        if (freeAt(nx, nz)) {
          nav.x = nx;
          nav.z = nz;
        } else if (freeAt(nx, nav.z)) nav.x = nx;
        else if (freeAt(nav.x, nz)) nav.z = nz;
        walked = true;
        walkedAt = performance.now();
        updateZone(false);
      }
    } else if (walked && performance.now() - walkedAt > 500) {
      walked = false;
      if (NY.onArrive) NY.onArrive({ zone: curZone, reason: 'walk' });
    }
    if (pulse) {
      act = true;
      const now = performance.now();
      if (now > pulse.until) {
        setPose(pulse.rec, hovered === pulse.rec ? 1 : 0);
        pulse = null;
        pinEl.hidden = true;
      } else setPose(pulse.rec, 0.35 + (0.65 * (Math.sin(now / 170) + 1)) / 2);
    }
    return act;
  }
  let frameN = 0;
  function render() {
    camera.position.set(nav.x, nav.eye || EYE, nav.z);
    camera.rotation.set(nav.pitch, nav.yaw, 0, 'YXZ');
    camera.fov = baseFov * zoom;
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
    needs = false;
    updateLabels();
    updatePin();
    if ((frameN++ & 1) === 0 && NY.onPose) NY.onPose(pose());
  }
  let last = performance.now();
  function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    const act = update(dt) || (drag.active && drag.moved) || !!pinch;
    if (!paused && (act || needs || now < keepAlive)) {
      render();
      if (act) adapt(dt);
    }
    if (VW && VW.active) {
      VW.ctr.update();
      VW.r.render(VW.sc, VW.cam);
    }
  }

  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    if (NY.toast) NY.toast('The 3D view paused. It resumes when the browser restores it.');
  });
  canvas.addEventListener('webglcontextrestored', () => {
    renderer.shadowMap.needsUpdate = true;
    needs = true;
    kick();
  });
  window.addEventListener('resize', () => {
    resize();
    kick();
  });
  if (window.ResizeObserver)
    new ResizeObserver(() => {
      resize();
      kick();
    }).observe(canvas);

  applyQuality((NY.settings && NY.settings.quality) || 'auto');
  if (camera.aspect < 0.75) nav.pitch = -0.13;
  captureMirrors();
  render();

  NY.attach3D({
    goZone(id, tag) {
      const z = NY.zoneById(id);
      if (!z) return;
      goTo(z.view.p[0], z.view.p[1], new V3(z.view.t[0], z.view.t[1], z.view.t[2]), { reason: 'zone', id, tag });
    },
    goProduct(pid, ci) {
      const rec = records.find((r) => r.pid === pid && r.ci === (ci || 0)) || records.find((r) => r.pid === pid);
      if (!rec) return;
      const dist =
        rec.kind === 'contacts'
          ? 1.15
          : rec.zone === 'kids'
            ? 1.0
            : rec.zone === 'women' || rec.zone === 'men'
              ? 1.15
              : 1.25;
      const at = new V3(rec.center.x + Math.sin(rec.ry) * dist, 0, rec.center.z + Math.cos(rec.ry) * dist);
      goTo(at.x, at.z, rec.center, { reason: 'product', rec });
    },
    goPoint(x, z) {
      goTo(x, z, null, { reason: 'point', clear: true });
    },
    mountViewer,
    setViewerColor(ci) {
      if (VW && VW.active && VW.pid) buildViewerModel(VW.pid, ci, VW.size);
    },
    setViewerSize(size) {
      if (VW && VW.active && VW.pid) buildViewerModel(VW.pid, VW.ci || 0, size);
    },
    unmountViewer,
    setQuality(m) {
      applyQuality(m);
      kick();
    },
    setLabels(on) {
      labelsOn = !!on;
      updateLabels();
    },
    setPaused(b) {
      paused = !!b;
      if (!paused) {
        needs = true;
        kick();
      } else updateLabels();
    },
    /** Where the visitor stands. */
    where() {
      return { x: nav.x, z: nav.z, yaw: nav.yaw, moving: nav.moving };
    },
    /** The walk planner's grid (tests). */
    navGrid() {
      return { x0: L.x0, z0: L.z0, cell: NAV.cell, cols: NAV.cols, rows: NAV.rows, blocked: Array.from(NAV.blocked) };
    },
    /** What a tap at screen point (cx, cy) would hit (tests): kind, point, distance and the surface's facing. */
    pick(cx, cy) {
      setRay(cx, cy);
      const hit = ray.intersectObjects(allHits, false)[0];
      if (!hit) return null;
      const o = hit.object;
      let n = { x: 0, z: 0 };
      if (hit.face) {
        const wn = hit.face.normal.clone().transformDirection(o.matrixWorld);
        n = { x: wn.x, z: wn.z };
      }
      const kind = o.userData.recs
        ? 'product'
        : o.userData.action
          ? 'feature'
          : o === floor || hit.point.y <= 0.05
            ? 'floor'
            : 'surface';
      return { kind, x: hit.point.x, y: hit.point.y, z: hit.point.z, dist: hit.distance, nx: n.x, nz: n.z };
    },
    /** Places the camera directly (tests and screenshots). eye: optional eye height in metres. */
    debugPose(x, z, yaw, pitch, eye) {
      nav.moving = false;
      nav.turn = null;
      Object.assign(nav, { x, z, yaw, pitch, eye: eye || null });
      needs = true;
      kick(600);
      updateZone(true);
    },
    stats() {
      return {
        draws: renderer.info.render.calls,
        tris: renderer.info.render.triangles,
        records: records.length,
        meshes: productMeshes.length,
      };
    },
  });
  requestAnimationFrame(loop);
}
