// Floor plan (metres), section lookups and fixture footprints. Store details and sections are in data/store.json.
import { BM } from '../core/bm.js';

/* Floor plan in metres. x runs left to right, z runs back (-8) to entrance (+8). */
BM.L = {
  x0: -11,
  x1: 11,
  z0: -8,
  z1: 8,
  H: 3.4,
  door: 1.6,
  men: { centers: [-2.2, 0, 2.2], width: 2.1 },
  women: { centers: [-1.2, 1.0, 3.2], width: 2.1 },
  kids: { center: 6.0, width: 2.6 },
  contacts: { center: -8.8, width: 3.4 },
  sun: { x: -4.0, z: 0.4, w: 3.4, d: 1.1 },
  lens: { x: 4.0, z: -0.2, w: 3.0, d: 1.0 },
  vitrines: [-3.4, -1.4, 0.6, 2.6],
  vitrineZ: -6.2,
  premium: { x: -0.6, w: 9.2 },
  eye: {
    x0: 6.2,
    z1: -3.2,
    door: [7.0, 8.4],
    chair: [8.8, -4.6],
    column: [9.75, -4.65],
    slit: [10.1, -5.7],
    desk: [10.35, -3.95],
  },
  counter: { x: 8.6, z: 6.55, w: 2.4, d: 0.65 },
  desk: { x: 3.0, z: 6.35, w: 1.8, d: 0.6 },
  totem: { x: -1.9, z: 5.6 },
  kidsTable: { x: -8.7, z: 6.0, r: 0.7 },
  beanbags: [
    [-7.15, 7.15],
    [-7.95, 7.45],
  ],
  contactsTable: { x: -8.8, z: -6.2, w: 1.2, d: 0.6 },
  mirror: { x: 10.95, z: 5.3 },
  mirrorStool: [10.25, 5.3],
  plants: [
    [-3.6, 7.45],
    [5.3, 7.45],
    [-5.6, -7.4],
    [4.4, -7.4],
    [10.45, -2.75],
    [-10.45, -3.75],
  ],
  stools: [
    [3.2, 0.75],
    [4.0, 0.75],
    [4.8, 0.75],
  ],
  ring: { x: 0, z: 0.6, r: 2.3 },
  rug: { x: 0, z: 0.6, r: 2.0 },
};

/* Store details, sections (BM.ZONES), tour order and tour text come from data/store.json via the data loader. */
BM.zoneById = (id) => BM.ZONES.find((z) => z.id === id) || null;
BM.zoneAt = (x, z) =>
  BM.ZONES.find((zn) => x >= zn.rect[0] && x <= zn.rect[2] && z >= zn.rect[1] && z <= zn.rect[3]) || null;

/* Fixture footprints, shared by the 3D builder, the walk planner and the floor plan. */
BM.obstacles = function () {
  const L = BM.L,
    o = [];
  const r = (x0, z0, x1, z1, k) =>
    o.push({ t: 'r', x0: Math.min(x0, x1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), z1: Math.max(z0, z1), k });
  const c = (x, z, rad, k) => o.push({ t: 'c', x, z, r: rad, k });
  for (const cz of L.men.centers) r(L.x0, cz - L.men.width / 2, L.x0 + 0.45, cz + L.men.width / 2, 'shelf');
  for (const cz of L.women.centers) r(L.x1 - 0.45, cz - L.women.width / 2, L.x1, cz + L.women.width / 2, 'shelf');
  r(L.x0, L.kids.center - L.kids.width / 2, L.x0 + 0.45, L.kids.center + L.kids.width / 2, 'shelf');
  r(L.contacts.center - L.contacts.width / 2, L.z0, L.contacts.center + L.contacts.width / 2, L.z0 + 0.45, 'shelf');
  r(L.premium.x - L.premium.w / 2, L.z0, L.premium.x + L.premium.w / 2, L.z0 + 0.34, 'shelf');
  for (const vx of L.vitrines) r(vx - 0.31, L.vitrineZ - 0.31, vx + 0.31, L.vitrineZ + 0.31, 'case');
  r(L.sun.x - L.sun.w / 2, L.sun.z - L.sun.d / 2, L.sun.x + L.sun.w / 2, L.sun.z + L.sun.d / 2, 'island');
  r(L.sun.x - L.sun.w / 2 - 0.55, L.sun.z - 0.12, L.sun.x - L.sun.w / 2 - 0.1, L.sun.z + 0.12, 'island');
  r(L.lens.x - L.lens.w / 2, L.lens.z - L.lens.d / 2, L.lens.x + L.lens.w / 2, L.lens.z + L.lens.d / 2, 'island');
  for (const s of L.stools) c(s[0], s[1], 0.2, 'stool');
  const e = L.eye;
  r(e.x0, e.z1 - 0.06, e.door[0], e.z1 + 0.06, 'wall');
  r(e.door[1], e.z1 - 0.06, L.x1, e.z1 + 0.06, 'wall');
  r(e.x0 - 0.06, L.z0, e.x0 + 0.06, e.z1, 'wall');
  c(e.chair[0], e.chair[1] + 0.05, 0.45, 'equip');
  c(e.column[0], e.column[1], 0.14, 'equip');
  r(e.slit[0] - 0.36, e.slit[1] - 0.27, e.slit[0] + 0.36, e.slit[1] + 0.27, 'equip');
  r(e.desk[0] - 0.5, e.desk[1] - 0.36, e.desk[0] + 0.5, e.desk[1] + 0.36, 'equip');
  r(
    L.counter.x - L.counter.w / 2,
    L.counter.z - L.counter.d / 2,
    L.counter.x + L.counter.w / 2,
    L.counter.z + L.counter.d / 2,
    'island',
  );
  r(L.desk.x - L.desk.w / 2, L.desk.z - L.desk.d / 2, L.desk.x + L.desk.w / 2, L.desk.z + L.desk.d / 2, 'island');
  r(L.totem.x - 0.34, L.totem.z - 0.16, L.totem.x + 0.34, L.totem.z + 0.16, 'equip');
  c(L.kidsTable.x, L.kidsTable.z, L.kidsTable.r, 'island');
  for (const b of L.beanbags) c(b[0], b[1], 0.36, 'equip');
  r(
    L.contactsTable.x - L.contactsTable.w / 2,
    L.contactsTable.z - L.contactsTable.d / 2,
    L.contactsTable.x + L.contactsTable.w / 2,
    L.contactsTable.z + L.contactsTable.d / 2,
    'island',
  );
  for (const p of L.plants) c(p[0], p[1], 0.22, 'plant');
  c(L.mirrorStool[0], L.mirrorStool[1], 0.2, 'stool');
  return o;
};
BM.OBS = BM.obstacles();
