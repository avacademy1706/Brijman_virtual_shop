// Store identity, floor plan (metres), sections and the guided tour. Edit this file to change the layout copy.
import { NY } from '../core/ny.js';

/* =====================================================================
   SAMPLE STORE DATA. Replace with the client's brand and catalogue.
   ===================================================================== */
NY.STORE = {
  name: 'Brijman Opticals',
  short: 'BRIJMAN',
  tagline: 'Eyewear salon and opticians',
  hours: 'Open daily, 11:00 am to 9:00 pm',
  address: 'Sample salon. Replace with the client’s address.',
  services: [
    'Free eye test with an optometrist',
    'Free fitting and frame adjustments',
    '7-day exchange on frames',
    'Home delivery or salon pickup',
  ],
};

/* Floor plan in metres. x runs left to right, z runs back (-6) to the entrance (+6), y is up.
   The side walls carry 0.3 m deep false walls: arched niches on the right, a lit niche on the left. */
const NICHE_Z = [];
for (let i = 0; i < 8; i++) NICHE_Z.push(+(-4.75 + i * 1.12).toFixed(2));
NY.L = {
  x0: -5.8,
  x1: 5.8,
  z0: -6,
  z1: 6,
  H: 3.3,
  door: 1.1, // half the width of the door opening in the glass front
  wall: 0.3, // false wall depth on both sides (niches are recessed into it)
  // right wall: eight arched niches, women at the back, men at the front
  niches: { zs: NICHE_Z, w: 0.6, y0: 0.3, y1: 2.62, depth: 0.24 },
  nicheShelves: [0.8, 1.0, 1.2, 1.4, 1.6, 1.8, 2.0, 2.2],
  // centre: the sunglasses island, the marble counter joined to it, and the raised drawer island behind
  islandA: { x: -0.2, z: 1.4, w: 3.0, d: 1.4, h: 0.9 },
  counter: { x: 1.85, z: 1.85, w: 1.1, d: 2.3, h: 0.92 },
  islandB: { x: 0.2, z: -1.9, w: 2.6, d: 0.95, h: 1.02 },
  // back wall: drawer cabinet with plinths and a lit white shelf unit above it
  hutch: { x: -0.4, w: 3.0, d: 0.55, h: 0.86, panel: [1.0, 2.46], shelves: [1.24, 1.54, 1.84, 2.14], slots: 6 },
  // left wall: the kids' niche at a child's eye level
  kids: { z: -2.9, w: 2.2, y0: 0.42, y1: 1.74, shelves: [0.6, 0.88, 1.16, 1.44], slots: 4 },
  // lounge: two velvet chairs, a side table, a rug
  lounge: {
    rug: { x: -3.85, z: 3.25, r: 1.3 },
    table: { x: -4.85, z: 3.3, r: 0.26 },
    chairs: [
      { x: -4.35, z: 2.25, face: [-3.0, 3.6] },
      { x: -4.2, z: 4.45, face: [-3.0, 3.1] },
    ],
  },
  // round floor mirrors: the lounge one opens the camera try-on
  mirrors: [
    { x: -5.1, z: 0.75, ry: Math.PI / 2, tryon: true },
    { x: 1.95, z: -5.55, ry: 0, tryon: false },
  ],
  // backlit posters: on the left wall, on the back wall, by the right-hand niches
  posters: [
    { id: 'solstice', x: -5.5, z: -5.0, ry: Math.PI / 2, w: 0.92, h: 1.5, y: 1.55 },
    { id: 'atelier', x: -4.25, z: -6, ry: 0, w: 1.0, h: 1.62, y: 1.6 },
    { id: 'clarity', x: 5.5, z: 4.6, ry: -Math.PI / 2, w: 0.9, h: 1.46, y: 1.55 },
  ],
  totem: { x: -2.0, z: 4.45, ry: 0 },
  vases: [
    [-5.15, 5.45, 1.0],
    [5.12, 5.66, 0.95],
    [3.2, -5.45, 0.85],
  ],
};

NY.ZONES = [
  {
    id: 'welcome',
    name: 'Entrance',
    short: 'Entrance',
    rect: [-2.6, 3.6, 3.0, 6],
    view: { p: [0.3, 5.15], t: [0, 1.25, -3.5] },
    anchor: [-2.0, 2.2, 4.45],
    label: [-0.1, 4.8],
    blurb: 'Step in. The directory screen by the door maps every section; the salon team is at the marble counter.',
  },
  {
    id: 'sun',
    name: 'Sunglasses Salon',
    short: 'Sunglasses',
    rect: [-2.6, -3.0, 1.3, 3.6],
    view: { p: [-0.2, 3.05], t: [-0.2, 0.92, 1.35] },
    anchor: [-0.2, 1.75, 1.4],
    label: [-0.9, 0.3],
    blurb:
      'UV400 sunglasses on travertine blocks across the marble island, and a polarised edit on the raised island behind.',
  },
  {
    id: 'counter',
    name: 'Lens & Care Counter',
    short: 'Counter',
    rect: [1.3, -3.0, 3.0, 3.6],
    view: { p: [2.95, 2.55], t: [1.85, 1.0, 1.7] },
    anchor: [1.85, 1.8, 1.85],
    label: [2.15, -0.9],
    blurb: 'Lens samples, contact lenses and care, and checkout. Ask here for a fitting or to book a free eye test.',
  },
  {
    id: 'men',
    name: 'Men’s Gallery',
    short: 'Men',
    rect: [3.0, -0.85, 5.5, 6],
    view: { p: [3.2, 1.4], t: [5.5, 1.45, 1.4] },
    anchor: [5.2, 2.95, 1.4],
    label: [4.3, 2.2],
    blurb: 'Four arched niches: titanium and steel first, then everyday acetate, rounds and browlines.',
  },
  {
    id: 'women',
    name: 'Women’s Gallery',
    short: 'Women',
    rect: [3.0, -6, 5.5, -0.85],
    view: { p: [3.2, -2.95], t: [5.5, 1.45, -2.95] },
    anchor: [5.2, 2.95, -2.95],
    label: [4.3, -3.4],
    blurb: 'Cat-eye, round and oversized frames in tortoise, crystal and fine metal, one pair to a shelf.',
  },
  {
    id: 'atelier',
    name: 'Atelier Wall',
    short: 'Atelier',
    rect: [-2.6, -6, 3.0, -3.0],
    view: { p: [-0.4, -3.45], t: [-0.4, 1.55, -6] },
    anchor: [-0.4, 2.75, -5.7],
    label: [-0.4, -4.2],
    blurb:
      'The premium Atelier pieces: beta titanium with 18K plating and hand-polished acetate, lit on the white wall.',
  },
  {
    id: 'kids',
    name: 'Little Ones',
    short: 'Kids',
    rect: [-5.5, -6, -2.6, -0.4],
    view: { p: [-3.75, -2.9], t: [-5.5, 1.0, -2.9] },
    anchor: [-5.4, 2.1, -2.9],
    label: [-4.35, -3.6],
    blurb: 'Flexible TR90 frames for ages 3 to 12 at a child’s eye level, plus UV400 sunglasses for small faces.',
  },
  {
    id: 'lounge',
    name: 'Lounge & Try-on',
    short: 'Lounge',
    rect: [-5.5, -0.4, -2.6, 6],
    view: { p: [-2.8, 2.7], t: [-4.6, 1.0, 2.3] },
    anchor: [-4.1, 1.7, 3.3],
    label: [-4.35, 1.6],
    blurb: 'Sit down and try frames on with your camera at the round mirror. The fit guide suggests your size.',
  },
];
NY.TOUR = ['welcome', 'sun', 'men', 'women', 'atelier', 'kids', 'lounge', 'counter'];
NY.TOUR_TEXT = {
  welcome:
    'Welcome to Brijman Opticals. The directory screen on your left maps the salon. Sunglasses are on the marble islands ahead, optical frames in the arched niches on the right.',
  sun: 'Every pair blocks UV up to 400 nm (UV400). Most have polarised lenses, and any style can be made to your prescription.',
  men: 'The men’s niches run from titanium and steel to everyday acetate, rounds and browlines. Tap any frame for sizes and lens options.',
  women:
    'Cat-eye, round and oversized shapes in tortoise, crystal and fine metal, one pair to a shelf so each can be seen.',
  atelier:
    'The Atelier collection: beta titanium with 18K plating and acetate polished by hand. The plinths hold this season’s pieces.',
  kids: 'Kids’ frames are flexible TR90, sized for ages 3 to 12, on shelves at a child’s eye level.',
  lounge:
    'Take a seat and try frames on with your camera. The fit guide measures your face width and suggests a frame size.',
  counter:
    'Compare lens types and coatings, pick up contact lenses and care, and pay here. Free fittings and eye tests are booked at this counter.',
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
  const box = (b, k) => r(b.x - b.w / 2, b.z - b.d / 2, b.x + b.w / 2, b.z + b.d / 2, k);
  // false walls on both sides
  r(L.x1 - L.wall, L.z0, L.x1, L.z1, 'wall');
  r(L.x0, L.z0, L.x0 + L.wall, L.z1, 'wall');
  // centre islands and counter
  box(L.islandA, 'island');
  box(L.counter, 'island');
  box(L.islandB, 'island');
  // back wall cabinet
  r(L.hutch.x - L.hutch.w / 2, L.z0, L.hutch.x + L.hutch.w / 2, L.z0 + L.hutch.d, 'shelf');
  // lounge
  const lg = L.lounge;
  c(lg.table.x, lg.table.z, lg.table.r + 0.04, 'equip');
  for (const ch of lg.chairs) c(ch.x, ch.z, 0.43, 'seat');
  for (const m of L.mirrors) c(m.x, m.z, 0.24, 'equip');
  r(L.totem.x - 0.3, L.totem.z - 0.14, L.totem.x + 0.3, L.totem.z + 0.14, 'equip');
  for (const v of L.vases) c(v[0], v[1], 0.24, 'plant');
  return o;
};
NY.OBS = NY.obstacles();
/** Where a visitor starts: just inside the door, looking into the salon. */
NY.START = { x: 0.3, z: 5.3, yaw: 0, pitch: -0.1 };
