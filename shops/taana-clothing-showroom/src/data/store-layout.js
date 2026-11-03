// Store identity, floor plan (metres), sections and the guided tour. Edit this file to change the layout copy.
import { NY } from '../core/ny.js';

/* =====================================================================
   SAMPLE STORE DATA. Replace with the client's brand and catalogue.
   ===================================================================== */
NY.STORE = {
  name: 'Taana Studio',
  tagline: 'Handloom, ethnic and everyday clothing',
  hours: 'Open daily, 11:00 am to 9:30 pm',
  address: 'Sample showroom. Replace with the client’s address.',
  services: [
    'Virtual try-on with live fabric simulation',
    'Free alterations on full-price pieces',
    '15-day exchange, store credit or refund',
    'Home delivery or showroom pickup',
  ],
};

/* Floor plan in metres. x runs left to right, z runs back (-8) to entrance (+8). */
NY.L = {
  x0: -11,
  x1: 11,
  z0: -8,
  z1: 8,
  H: 3.4,
  door: 1.6,
  // wall bays (left wall: women's ethnic, right wall: men's)
  ethnic: { centers: [-2.2, 0, 2.2], width: 2.1 },
  mens: { centers: [-1.2, 1.0, 3.2], width: 2.1 },
  kids: { center: 6.0, width: 2.6 },
  western: { center: -8.8, width: 3.4 },
  // islands
  basics: { x: -4.0, z: 0.4, w: 3.4, d: 1.1 },
  dupatta: { x: 4.0, z: -0.2, w: 3.0, d: 1.0 },
  // centre podium with three live-simulated mannequins
  podium: { x: 0, z: 0.7, r: 1.05 },
  // Chikankari studio on the back wall: feature wall plus four dress forms
  chikan: { x: -0.6, w: 9.2, forms: [-3.4, -1.4, 0.6, 2.6], formZ: -6.0 },
  // Fitting rooms: enclosure in the back-right corner
  fit: {
    x0: 6.2,
    z1: -3.2,
    door: [7.0, 8.4],
    cubicles: [7.15, 8.55, 9.95], // centres along the back wall
    cubW: 1.3,
    cubD: 1.35,
    mirror: [10.93, -4.75], // try-on mirror on the right wall (x, z)
    mannequin: [9.0, -4.35],
    ottoman: [7.2, -4.6],
  },
  counter: { x: 8.6, z: 6.55, w: 2.4, d: 0.65 },
  desk: { x: 3.0, z: 6.35, w: 1.8, d: 0.6 },
  totem: { x: -1.9, z: 5.6 },
  kidsTable: { x: -8.7, z: 6.0, r: 0.7 },
  beanbags: [
    [-7.15, 7.15],
    [-7.95, 7.45],
  ],
  westernTable: { x: -8.8, z: -6.0, w: 1.4, d: 0.7 },
  westernForm: [-6.7, -6.6],
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
  ring: { x: 0, z: 0.7, r: 2.1 },
};

NY.ZONES = [
  {
    id: 'welcome',
    name: 'Welcome & Directory',
    short: 'Welcome',
    rect: [-4.2, 4.4, 4.2, 8],
    view: { p: [0, 6.9], t: [0, 1.3, -2] },
    anchor: [-1.9, 2.25, 5.6],
    blurb: 'Start at the directory screen. The stylist desk takes alteration and pickup requests.',
  },
  {
    id: 'festive',
    name: 'Festive Edit',
    short: 'Festive',
    rect: [-1.6, -2.8, 1.6, 4.4],
    view: { p: [0, 3.55], t: [0, 1.2, 0.7] },
    anchor: [0, 2.55, 0.7],
    blurb: 'Three looks on a slow turntable. The fabric is simulated live, so you can see how each piece moves.',
  },
  {
    id: 'kids',
    name: 'Kids',
    short: 'Kids',
    rect: [-11, 4.4, -6.2, 8],
    view: { p: [-6.85, 4.85], t: [-9.7, 0.85, 6.3] },
    anchor: [-10.5, 1.9, 6.0],
    blurb: 'Soft cotton kurtas, dresses and tees for ages 4 to 13.',
  },
  {
    id: 'ethnic',
    name: 'Women · Ethnic',
    short: 'Ethnic',
    rect: [-11, -3.8, -7.3, 4.4],
    view: { p: [-7.6, 0], t: [-11, 1.4, 0] },
    anchor: [-10.6, 2.45, 0],
    blurb: 'Kurtas and anarkalis in three bays: everyday cotton, festive georgette and silk, then long kurtas.',
  },
  {
    id: 'basics',
    name: 'Denim & Basics',
    short: 'Basics',
    rect: [-7.3, -2.8, -1.6, 4.4],
    view: { p: [-4.0, 2.75], t: [-4.0, 0.95, 0.4] },
    anchor: [-4.0, 2.05, 0.4],
    blurb: 'Crew tees, pocket tees and denim shirts, folded by colour on a two-tier table.',
  },
  {
    id: 'western',
    name: 'Women · Western',
    short: 'Western',
    rect: [-11, -8, -6.2, -3.8],
    view: { p: [-8.8, -4.6], t: [-8.8, 1.3, -8] },
    anchor: [-8.8, 2.4, -7.7],
    blurb: 'Dresses, shirts and tees. The dress form shows the midi dress in motion.',
  },
  {
    id: 'chikan',
    name: 'Chikankari Studio',
    short: 'Chikankari',
    rect: [-6.2, -8, 6.0, -2.8],
    view: { p: [-0.4, -3.3], t: [-0.4, 1.3, -6.6] },
    anchor: [-0.4, 2.15, -6.2],
    blurb: 'Hand-embroidered Lucknowi chikankari on georgette and cotton, shown on four dress forms.',
  },
  {
    id: 'fitting',
    name: 'Fitting Rooms & Try-on Mirror',
    short: 'Try-on',
    rect: [6.2, -8, 11, -3.2],
    view: { p: [7.6, -3.75], t: [10.4, 1.3, -4.9] },
    anchor: [7.7, 1.95, -3.1],
    blurb: 'Three cubicles and a try-on mirror. Turn on your camera and the garment drapes over you, live.',
  },
  {
    id: 'dupatta',
    name: 'Dupatta & Stole Bar',
    short: 'Dupattas',
    rect: [1.6, -2.8, 7.4, 4.4],
    view: { p: [4.0, 3.2], t: [4.0, 1.0, -0.2] },
    anchor: [4.0, 2.05, -0.2],
    blurb: 'Silk, chiffon and cotton dupattas, plus stoles. The form shows the one-shoulder drape.',
  },
  {
    id: 'mens',
    name: 'Men’s Wear',
    short: 'Men',
    rect: [7.4, -3.2, 11, 4.4],
    view: { p: [7.6, 1.0], t: [11, 1.4, 1.0] },
    anchor: [10.6, 2.45, 1.0],
    blurb: 'Shirts, kurtas and Nehru jackets. Pair a jacket with any kurta in the try-on.',
  },
  {
    id: 'checkout',
    name: 'Tailoring & Checkout',
    short: 'Checkout',
    rect: [4.2, 4.4, 11, 8],
    view: { p: [7.6, 4.7], t: [9.0, 1.05, 6.55] },
    anchor: [8.6, 2.05, 6.55],
    blurb: 'Pay at the counter or online. The tailor’s mirror handles hemming and sleeve alterations.',
  },
];
NY.TOUR = [
  'welcome',
  'festive',
  'ethnic',
  'kids',
  'basics',
  'western',
  'chikan',
  'fitting',
  'dupatta',
  'mens',
  'checkout',
];
NY.TOUR_TEXT = {
  welcome:
    'This is the entrance. The directory on your left maps every section, and the stylist desk handles alterations and pickups.',
  festive:
    'The Festive Edit turns slowly so you can watch the fabric. Georgette swings, silk flows and linen holds its shape.',
  ethnic:
    'Three bays of kurtas and anarkalis: everyday block prints, festive georgette and silk, then the long kurtas. Tap any piece for sizes and try-on.',
  kids: 'Kids’ pieces are soft cotton, sized by age from 4 to 13. The low rail keeps them at a child’s eye level.',
  basics: 'Tees and denim shirts, folded by colour. Every tee comes in six colours and six sizes.',
  western: 'Dresses, shirts and tees. The dress form on the right shows how the midi dress moves.',
  chikan:
    'Chikankari is shadow-work embroidery from Lucknow, done by hand on fine fabric. Each piece takes several weeks.',
  fitting:
    'The try-on mirror uses your camera. It tracks your shoulders and arms, then simulates the fabric over you as you move. Nothing leaves your device.',
  dupatta:
    'Dupattas and stoles in silk, chiffon and cotton. The form shows the one-shoulder drape, and the try-on has the stole drape too.',
  mens: 'Shirts, kurtas and Nehru jackets. In the try-on you can layer any jacket over a kurta.',
  checkout: 'Your bag and checkout are one tap away. Alterations are free on full-price pieces.',
};
NY.zoneById = (id) => NY.ZONES.find((z) => z.id === id) || null;
NY.zoneAt = (x, z) =>
  NY.ZONES.find((zn) => x >= zn.rect[0] && x <= zn.rect[2] && z >= zn.rect[1] && z <= zn.rect[3]) || null;

/* Fixture footprints, shared by the 3D builder, the walk planner and the floor plan. */
NY.obstacles = function () {
  const L = NY.L,
    o = [];
  const r = (x0, z0, x1, z1, k) =>
    o.push({ t: 'r', x0: Math.min(x0, x1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), z1: Math.max(z0, z1), k });
  const c = (x, z, rad, k) => o.push({ t: 'c', x, z, r: rad, k });
  for (const cz of L.ethnic.centers) r(L.x0, cz - L.ethnic.width / 2, L.x0 + 0.62, cz + L.ethnic.width / 2, 'shelf');
  for (const cz of L.mens.centers) r(L.x1 - 0.62, cz - L.mens.width / 2, L.x1, cz + L.mens.width / 2, 'shelf');
  r(L.x0, L.kids.center - L.kids.width / 2, L.x0 + 0.55, L.kids.center + L.kids.width / 2, 'shelf');
  r(L.western.center - L.western.width / 2, L.z0, L.western.center + L.western.width / 2, L.z0 + 0.62, 'shelf');
  r(L.chikan.x - L.chikan.w / 2, L.z0, L.chikan.x + L.chikan.w / 2, L.z0 + 0.36, 'shelf');
  for (const fx of L.chikan.forms) c(fx, L.chikan.formZ, 0.42, 'form');
  r(
    L.basics.x - L.basics.w / 2,
    L.basics.z - L.basics.d / 2,
    L.basics.x + L.basics.w / 2,
    L.basics.z + L.basics.d / 2,
    'island',
  );
  r(
    L.dupatta.x - L.dupatta.w / 2,
    L.dupatta.z - L.dupatta.d / 2,
    L.dupatta.x + L.dupatta.w / 2,
    L.dupatta.z + L.dupatta.d / 2,
    'island',
  );
  c(L.dupatta.x + L.dupatta.w / 2 + 0.45, L.dupatta.z, 0.32, 'form');
  c(L.basics.x - L.basics.w / 2 - 0.45, L.basics.z, 0.32, 'form');
  for (const s of L.stools) c(s[0], s[1], 0.2, 'stool');
  c(L.podium.x, L.podium.z, L.podium.r, 'island');
  const f = L.fit;
  r(f.x0, f.z1 - 0.06, f.door[0], f.z1 + 0.06, 'wall');
  r(f.door[1], f.z1 - 0.06, L.x1, f.z1 + 0.06, 'wall');
  r(f.x0 - 0.06, L.z0, f.x0 + 0.06, f.z1, 'wall');
  // cubicles: partitions and the curtained fronts
  const cz1 = L.z0 + f.cubD;
  for (let i = 0; i <= f.cubicles.length; i++) {
    const x = f.cubicles[0] - f.cubW / 2 + i * f.cubW;
    r(x - 0.04, L.z0, x + 0.04, cz1, 'wall');
  }
  r(f.cubicles[0] - f.cubW / 2, cz1 - 0.12, f.cubicles[f.cubicles.length - 1] + f.cubW / 2, cz1 + 0.12, 'curtain');
  r(f.mirror[0] - 0.12, f.mirror[1] - 0.55, L.x1, f.mirror[1] + 0.55, 'equip');
  c(f.mannequin[0], f.mannequin[1], 0.36, 'form');
  c(f.ottoman[0], f.ottoman[1], 0.4, 'equip');
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
  const T = L.westernTable;
  r(T.x - T.w / 2, T.z - T.d / 2, T.x + T.w / 2, T.z + T.d / 2, 'island');
  c(L.westernForm[0], L.westernForm[1], 0.36, 'form');
  for (const p of L.plants) c(p[0], p[1], 0.22, 'plant');
  c(L.mirrorStool[0], L.mirrorStool[1], 0.2, 'stool');
  return o;
};
NY.OBS = NY.obstacles();

/*
 * Keep-out areas: places a shopper should not walk into even where there is room. Behind the checkout counter
 * and the stylist desk, behind the dress forms and the western table, and the strip along the walls where the
 * bays and shelves stand (so nobody squeezes into the gaps between them). Rectangles in metres; the walk planner
 * keeps the visitor's position out of them. Add a rectangle here to close off another spot.
 */
NY.noGo = function () {
  const L = NY.L,
    f = L.fit,
    o = [];
  const r = (x0, z0, x1, z1, why) =>
    o.push({ x0: Math.min(x0, x1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), z1: Math.max(z0, z1), why });
  const C = L.counter,
    Dk = L.desk,
    T = L.westernTable;
  r(C.x - C.w / 2 - 0.1, C.z + C.d / 2, L.x1, L.z1, 'behind the checkout counter');
  r(C.x + C.w / 2, L.mirror.z + 0.65, L.x1, L.z1, 'corner beside the counter');
  r(Dk.x - Dk.w / 2 - 0.1, Dk.z + Dk.d / 2, Dk.x + Dk.w / 2 + 0.1, L.z1, 'behind the stylist desk');
  r(
    L.chikan.forms[0] - 0.42,
    L.z0,
    L.chikan.forms[L.chikan.forms.length - 1] + 0.42,
    L.chikan.formZ,
    'behind the dress forms',
  );
  r(T.x - T.w / 2, L.z0, T.x + T.w / 2, T.z, 'behind the western table');
  r(L.x0, L.kidsTable.z, L.kidsTable.x, L.z1, 'behind the kids table');
  r(L.x0, L.z0, L.x0 + 0.62, L.z1, 'left wall bays');
  r(L.x1 - 0.62, f.z1, L.x1, L.mirror.z - 0.6, 'right wall bays');
  r(L.x0, L.z0, f.x0, L.z0 + 0.62, 'back wall shelves');
  return o;
};
NY.NO_GO = NY.noGo();
