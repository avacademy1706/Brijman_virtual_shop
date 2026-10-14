// Store identity, floor plan (metres), sections and the guided tour. Edit this file to change the layout copy.
import { BM } from '../core/bm.js';

/* =====================================================================
   SAMPLE STORE DATA. Replace with the client's brand and catalogue.
   ===================================================================== */
BM.STORE = {
  name: 'Brijman Eyewear',
  tagline: 'Opticians and eyewear studio',
  hours: 'Open daily, 10:30 am to 9:00 pm',
  address: 'Sample showroom. Replace with the client’s address.',
  services: [
    'Free eye test with an optometrist',
    'Free fitting and frame adjustments',
    '7-day exchange on frames',
    'Home delivery or showroom pickup',
  ],
};

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

BM.ZONES = [
  {
    id: 'welcome',
    name: 'Welcome & Directory',
    short: 'Welcome',
    rect: [-4.2, 4.4, 4.2, 8],
    view: { p: [0, 6.9], t: [0, 1.3, -2] },
    anchor: [-1.9, 2.25, 5.6],
    blurb: 'Start at the directory screen. The concierge desk handles repairs, collections and returns.',
  },
  {
    id: 'kids',
    name: 'Kids Corner',
    short: 'Kids',
    rect: [-11, 4.4, -6.2, 8],
    view: { p: [-6.85, 4.85], t: [-9.7, 0.75, 6.3] },
    anchor: [-10.5, 1.8, 6.0],
    blurb: 'Flexible TR90 frames sized for ages 3 to 12, plus UV400 sunglasses for small faces.',
  },
  {
    id: 'men',
    name: 'Men’s Collection',
    short: 'Men',
    rect: [-11, -3.8, -7.3, 4.4],
    view: { p: [-7.7, 0], t: [-11, 1.6, 0] },
    anchor: [-10.6, 2.3, 0],
    blurb: 'Twelve styles across three bays: titanium and steel, everyday acetate, then rounds and browlines.',
  },
  {
    id: 'sun',
    name: 'Sunglasses Island',
    short: 'Sunglasses',
    rect: [-7.3, -2.8, -0.8, 3.0],
    view: { p: [-4.0, 2.7], t: [-4.0, 0.95, 0.4] },
    anchor: [-4.0, 1.95, 0.4],
    blurb:
      'UV400 sunglasses on a two-tier island. Most styles have polarised lenses, and any pair can take your prescription.',
  },
  {
    id: 'contacts',
    name: 'Contact Lenses & Care',
    short: 'Contacts',
    rect: [-11, -8, -6.2, -3.8],
    view: { p: [-8.8, -4.9], t: [-8.8, 1.25, -8] },
    anchor: [-8.8, 2.3, -7.7],
    blurb: 'Daily, monthly, toric and coloured lenses, with solutions, drops and cases.',
  },
  {
    id: 'premium',
    name: 'Atelier Premium Gallery',
    short: 'Atelier',
    rect: [-6.2, -8, 6.0, -2.8],
    view: { p: [-0.4, -3.25], t: [-0.4, 1.3, -7.0] },
    anchor: [-0.4, 2.0, -6.2],
    blurb: 'Lit vitrines hold the Atelier pieces: beta titanium, 18K plating and hand-polished acetate.',
  },
  {
    id: 'eyetest',
    name: 'Eye Test Room',
    short: 'Eye test',
    rect: [6.2, -8, 11, -3.2],
    view: { p: [7.3, -3.85], t: [9.0, 1.05, -7.0] },
    anchor: [7.7, 1.9, -3.1],
    blurb: 'A free 20-minute eye test with an optometrist. You leave with your prescription.',
  },
  {
    id: 'lensbar',
    name: 'Lens Bar',
    short: 'Lens bar',
    rect: [0.8, -2.8, 7.4, 3.0],
    view: { p: [4.0, 2.55], t: [4.0, 1.0, -0.2] },
    anchor: [4.0, 1.95, -0.2],
    blurb: 'Compare lens types, coatings and thickness before you choose. Ask for a blue-cut or photochromic demo.',
  },
  {
    id: 'women',
    name: 'Women’s Collection',
    short: 'Women',
    rect: [7.4, -3.2, 11, 4.4],
    view: { p: [7.7, 1.0], t: [11, 1.6, 1.0] },
    anchor: [10.6, 2.3, 1.0],
    blurb: 'Cat-eye, round and oversized frames in tortoise, crystal and fine metal.',
  },
  {
    id: 'checkout',
    name: 'Fitting & Checkout',
    short: 'Checkout',
    rect: [4.2, 4.4, 11, 8],
    view: { p: [7.6, 4.7], t: [9.0, 1.05, 6.55] },
    anchor: [8.6, 2.05, 6.55],
    blurb: 'Every frame gets a free fitting here. Review your bag and pay at the counter or online.',
  },
];
BM.TOUR = ['welcome', 'kids', 'men', 'sun', 'contacts', 'premium', 'eyetest', 'lensbar', 'women', 'checkout'];
BM.TOUR_TEXT = {
  welcome:
    'This is the entrance. The directory screen on your left maps every section, and the concierge desk handles repairs and collections.',
  kids: 'Kids’ frames are flexible TR90, sized for ages 3 to 12. The low shelf keeps them at a child’s eye level.',
  men: 'Three bays, arranged by material: titanium and steel, everyday acetate, then rounds and browlines. Tap any frame for sizes and lens options.',
  sun: 'Every pair blocks UV up to 400 nm (UV400). Most have polarised lenses, and any style can be made to your prescription.',
  contacts:
    'Daily, monthly, toric and coloured lenses, plus solutions and drops. A contact lens prescription is needed at checkout.',
  premium: 'The Atelier collection sits in lit vitrines: beta titanium with 18K plating, and acetate polished by hand.',
  eyetest: 'Free 20-minute eye tests with an optometrist. The chart uses metric Snellen lines, from 6/60 down to 6/5.',
  lensbar: 'Compare lens types, coatings and thickness here. A higher index gives a thinner lens for the same power.',
  women: 'Cat-eye, round and oversized shapes in tortoise, crystal and fine metal.',
  checkout: 'Frames get a free fitting at the counter. Your bag and checkout are one tap away.',
};
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
