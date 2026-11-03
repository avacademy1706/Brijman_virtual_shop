// Store identity, floor plan (metres), sections, guided tour, fixture footprints and keep-out areas.
// The boutique is a domed octagonal rotunda with six salons opening off it, a foyer at the front and a private
// bridal lounge at the back. Edit this file to change names, copy or the plan.
import { NY } from '../core/ny.js';

/* =====================================================================
   SAMPLE STORE DATA. Replace with the client's brand.
   ===================================================================== */
NY.STORE = {
  name: 'Kanak',
  full: 'Kanak Fine Jewellery',
  tagline: 'Fine jewellery in gold, diamonds and heritage polki',
  hours: 'Open daily, 11:00 am to 8:30 pm',
  address: 'Sample boutique. Replace with the client’s address.',
  phone: '+91 00000 00000',
  services: [
    'BIS hallmarked gold with HUID on every piece',
    'Certified diamonds (IGI) above 0.30 carat',
    'Private viewings in the Bridal Lounge, in store or by video call',
    'Lifetime exchange at the day’s gold rate',
    'Free resizing within 30 days',
    'Insured delivery across India',
  ],
};

/* ---------- Plan geometry ---------- */
// x runs left to right, z runs back (-) to the entrance (+). Rotunda centre at the origin.
const A = 6.4; // distance from the centre to the inside of each rotunda wall
const WT = 0.35; // wall thickness
NY.L = {
  A,
  WT,
  H: 4.8, // rotunda wall height (the dome rises above it)
  domeH: 3.6,
  salonH: 4.0,
  opening: 3.0, // width of each salon arch
  archSpring: 2.3, // height where an arch starts to curve
  salon: { W: 4.6, D: 3.7 },
  foyer: { W: 6.0, D: 4.2, opening: 3.4, door: 2.4, H: 4.4 },
  lounge: { W: 6.4, D: 5.2, opening: 3.2, H: 4.2 },
  hero: { r: 0.85 },
  pillarR: 4.2,
  pillarAngles: [22.5, -22.5, 157.5, 202.5],
};
const L = NY.L;
L.R = A / Math.cos(Math.PI / 8); // octagon corner radius

/** The eight sides of the rotunda: 0 entrance (+z), then clockwise seen from above (towards +x first). */
NY.SIDES = ['foyer', 'gems', 'diamond', 'solitaire', 'lounge', 'polki', 'temple', 'everyday'];
/**
 * Frame of side k: origin on the inside face of the rotunda wall, v outwards (depth), u sideways.
 * toWorld(u, v) -> [x, z]. In 3D the frame is a rotation about y by `yaw` (local x = u, local z = v, so local +z
 * points away from the centre, into the salon) after a move of A along the side's normal.
 */
NY.sideFrame = (k) => {
  const a = (k * Math.PI) / 4;
  const n = [Math.sin(a), Math.cos(a)];
  const l = [Math.cos(a), -Math.sin(a)];
  return {
    k,
    a,
    n,
    l,
    toWorld: (u, v) => [n[0] * (A + v) + l[0] * u, n[1] * (A + v) + l[1] * u],
    yaw: a,
  };
};
NY.sideOf = (id) => NY.SIDES.indexOf(id);

/* ---------- Rooms (polygons in x, z), for the floor plan, zones and the walk grid ---------- */
function rect(k, u0, v0, u1, v1) {
  const f = NY.sideFrame(k);
  return [f.toWorld(u0, v0), f.toWorld(u1, v0), f.toWorld(u1, v1), f.toWorld(u0, v1)];
}
function octagon(r) {
  const pts = [];
  for (let i = 0; i < 8; i++) {
    const a = Math.PI / 8 + (i * Math.PI) / 4;
    pts.push([r * Math.sin(a), r * Math.cos(a)]);
  }
  return pts;
}
NY.ROOMS = (() => {
  const rooms = [{ id: 'rotunda', poly: octagon(L.R) }];
  NY.SIDES.forEach((id, k) => {
    const dims = id === 'foyer' ? L.foyer : id === 'lounge' ? L.lounge : L.salon;
    const open = dims.opening || L.opening;
    rooms.push({ id: id + '-arch', poly: rect(k, -open / 2, -0.02, open / 2, WT + 0.02), arch: true, side: id });
    rooms.push({ id, poly: rect(k, -dims.W / 2, WT, dims.W / 2, WT + dims.D), side: id });
  });
  return rooms;
})();

/* ---------- Sections ---------- */
const view = (k, u, v, tu, tv, ty) => {
  const f = NY.sideFrame(k);
  const p = f.toWorld(u, v),
    t = f.toWorld(tu, tv);
  return { p, t: [t[0], ty, t[1]] };
};
const anchor = (k, u, v, y) => {
  const p = NY.sideFrame(k).toWorld(u, v);
  return [p[0], y, p[1]];
};
const SALON = (id, name, short, blurb, colors) => {
  const k = NY.sideOf(id);
  return {
    id,
    name,
    short,
    blurb,
    side: k,
    poly: rect(k, -L.salon.W / 2, -0.4, L.salon.W / 2, WT + L.salon.D),
    view: view(k, 0, 1.75, 0, 3.7, 1.25),
    anchor: anchor(k, 0, -0.25, 3.0),
    colors,
  };
};
NY.ZONES = [
  {
    id: 'foyer',
    name: 'Foyer & Today’s Rates',
    short: 'Foyer',
    side: 0,
    poly: rect(0, -L.foyer.W / 2, -0.4, L.foyer.W / 2, WT + L.foyer.D),
    view: view(0, 0, 3.2, 0, -1.0, 1.55),
    anchor: anchor(0, 0, 2.8, 2.9),
    blurb: 'Today’s gold and platinum rates are on the board, and the concierge books private viewings.',
  },
  {
    id: 'rotunda',
    name: 'The Rotunda',
    short: 'Rotunda',
    poly: octagon(L.R - 0.4),
    view: { p: [0, 3.4], t: [0, 1.25, 0] },
    anchor: [0, 2.75, 0],
    blurb:
      'Our signature Maharani Rani Haar turns under the dome. The four pillar cases hold one statement piece each.',
  },
  SALON(
    'everyday',
    'Everyday & Men’s',
    'Everyday',
    'Chains, pendants, studs and hoops for every day, and the men’s collection: kadas, rope chains, curb bracelets and signets.',
    { velvet: '#1c2742', wall: '#ebe5da', accent: '#c9a45c' },
  ),
  SALON(
    'temple',
    'Temple & Antique Gold',
    'Temple',
    'South Indian temple jewellery in 22K antique gold: coin necklaces, peacock chokers, jhumkas and kadas.',
    { velvet: '#5a1420', wall: '#eadbc4', accent: '#c58f3c' },
  ),
  SALON(
    'polki',
    'Polki & Kundan',
    'Polki',
    'Uncut diamonds and kundan set the Mughal way, on gold foil: rani haars, chokers, chandbalis, tikkas and naths.',
    { velvet: '#0f3a2d', wall: '#e7e1d3', accent: '#caa45a' },
  ),
  {
    id: 'lounge',
    name: 'The Bridal Lounge',
    short: 'Bridal',
    side: 4,
    poly: rect(4, -L.lounge.W / 2, -0.4, L.lounge.W / 2, WT + L.lounge.D),
    view: view(4, 0, 1.15, 0, 4.4, 1.05),
    anchor: anchor(4, 0, -0.25, 3.05),
    blurb:
      'A private salon for brides and families. Sit down with our bridal sets, try them on at the mirror, or book a viewing.',
    colors: { velvet: '#4a1d31', wall: '#ecd8d0', accent: '#c9a45c' },
  },
  SALON(
    'solitaire',
    'Solitaires & Rings',
    'Solitaires',
    'Engagement rings and bands: solitaires from 0.30 to 1.50 carat, halos, three-stone rings and eternity bands.',
    { velvet: '#10131d', wall: '#e1e0dc', accent: '#d9d6cf' },
  ),
  SALON(
    'diamond',
    'Diamond Atelier',
    'Diamonds',
    'Diamond necklaces, drops, studs, tennis bracelets and bangles in 18K gold and platinum.',
    { velvet: '#19191e', wall: '#e5e2dd', accent: '#d8d4cc' },
  ),
  SALON(
    'gems',
    'Pearls & Gemstones',
    'Gemstones',
    'Rubies, emeralds and sapphires, South Sea pearls and the Navratna. Most pieces can be made in another stone.',
    { velvet: '#0e3a42', wall: '#e6dfd3', accent: '#c9a45c' },
  ),
];
NY.TOUR = ['foyer', 'rotunda', 'everyday', 'temple', 'polki', 'lounge', 'solitaire', 'diamond', 'gems'];
NY.TOUR_TEXT = {
  foyer:
    'Welcome to Kanak. The board on your left shows today’s gold and platinum rates; every price in the boutique is worked out from them, live.',
  rotunda:
    'Under the dome turns the Maharani Rani Haar: three strands of pearls and emeralds meeting at a polki medallion. Tap it to see how it is priced.',
  everyday:
    'Light pieces for every day and the men’s collection. Gold chains and pendants are priced by weight, so a longer chain costs a little more.',
  temple:
    'Temple jewellery began as ornaments for temple deities in South India. The antique finish darkens the recesses so the carving stands out.',
  polki:
    'Polki are uncut diamonds, sliced flat and backed with gold foil, the way Mughal jewellers worked. Kundan is the gold that holds them.',
  lounge:
    'The Bridal Lounge is for unhurried decisions. The three cases hold complete bridal sets, and the mirror opens the camera try-on.',
  solitaire:
    'Choose the carat, the colour and clarity, the metal and the ring size; the price updates as you go. Every centre stone above 0.30 carat comes with an IGI certificate.',
  diamond: 'Diamond necklaces, drops and bracelets. Watch how the stones flash as you move: that is the cut working.',
  gems: 'Rubies, emeralds and sapphires, and South Sea pearls. Most gemstone pieces can be made in another stone; the price changes with it.',
};
NY.zoneById = (id) => NY.ZONES.find((z) => z.id === id) || null;
function inPoly(x, z, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0],
      zi = poly[i][1],
      xj = poly[j][0],
      zj = poly[j][1];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}
NY.inPoly = inPoly;
/** Section at a point. Salons, foyer and lounge first (they include their arch), then the rotunda. */
NY.zoneAt = (x, z) => {
  for (const zn of NY.ZONES) if (zn.id !== 'rotunda' && inPoly(x, z, zn.poly)) return zn;
  const r = NY.zoneById('rotunda');
  return inPoly(x, z, octagon(L.R)) ? r : null;
};
/** True if the point is inside the boutique (any room or arch). */
NY.inside = (x, z) => NY.ROOMS.some((r) => inPoly(x, z, r.poly));
NY.BOUNDS = (() => {
  let x0 = Infinity,
    x1 = -Infinity,
    z0 = Infinity,
    z1 = -Infinity;
  for (const r of NY.ROOMS)
    for (const [x, z] of r.poly) {
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      z0 = Math.min(z0, z);
      z1 = Math.max(z1, z);
    }
  return { x0: x0 - WT, x1: x1 + WT, z0: z0 - WT, z1: z1 + WT };
})();
/** Where a visit starts: inside the entrance doors, facing the rotunda. */
NY.START = (() => {
  const p = NY.sideFrame(0).toWorld(0, WT + L.foyer.D - 0.75);
  return { x: p[0], z: p[1], yaw: 0 };
})();

/* ---------- Fixture footprints (shared by the 3D builder, the walk planner and the floor plan) ---------- */
// t: 'c' circle { x, z, r } or 'p' polygon { pts }; k: kind
NY.SALON_FIX = {
  // salon fixtures in the salon frame (u sideways, v depth from the rotunda wall)
  counter: { u: 1.0, v0: 2.85, v1: 3.42, h: 0.98 },
  sideCase: { u0: 1.83, u1: 2.3, v0: 0.75, v1: 2.75, h: 0.92, top: 1.85 },
  niches: [-1.35, 0, 1.35],
  nicheW: 0.8,
  stools: [
    [-0.48, 2.5],
    [0.48, 2.5],
  ],
};
NY.obstacles = function () {
  const o = [];
  const poly = (pts, k) => o.push({ t: 'p', pts, k });
  const circ = (x, z, r, k) => o.push({ t: 'c', x, z, r, k });
  circ(0, 0, L.hero.r, 'plinth');
  for (const a of L.pillarAngles) {
    const r = (a * Math.PI) / 180;
    circ(L.pillarR * Math.sin(r), L.pillarR * Math.cos(r), 0.42, 'pillar');
  }
  const F = NY.SALON_FIX;
  NY.SIDES.forEach((id, k) => {
    if (id === 'foyer' || id === 'lounge') return;
    const f = NY.sideFrame(k);
    poly(rect(k, -F.counter.u, F.counter.v0, F.counter.u, F.counter.v1), 'counter');
    poly(rect(k, F.sideCase.u0, F.sideCase.v0, F.sideCase.u1, F.sideCase.v1), 'case');
    poly(rect(k, -F.sideCase.u1, F.sideCase.v0, -F.sideCase.u0, F.sideCase.v1), 'case');
    for (const [u, v] of F.stools) {
      const p = f.toWorld(u, v);
      circ(p[0], p[1], 0.2, 'stool');
    }
  });
  // foyer: two glass columns at the rotunda arch, the concierge desk, the rates board
  const fy = (u, v) => NY.sideFrame(0).toWorld(u, v);
  for (const s of [-1, 1]) {
    const p = fy(s * 2.25, 1.15);
    circ(p[0], p[1], 0.36, 'column');
  }
  poly(rect(0, 2.2, 2.2, 3.0, 3.7), 'desk');
  poly(rect(0, -3.0, 1.9, -2.82, 3.9), 'board');
  // lounge: sofa, coffee table, armchairs, cases, mirror
  poly(rect(4, -1.5, 4.55, 1.5, 5.5), 'sofa');
  poly(rect(4, -0.85, 3.25, 0.85, 3.95), 'table');
  for (const s of [-1, 1]) {
    const p = NY.sideFrame(4).toWorld(s * 1.75, 3.6);
    circ(p[0], p[1], 0.42, 'chair');
  }
  poly(rect(4, -3.2, 1.2, -2.72, 2.6), 'case');
  poly(rect(4, -3.2, 3.2, -2.72, 4.6), 'case');
  poly(rect(4, 2.72, 1.0, 3.2, 2.2), 'case');
  poly(rect(4, 3.05, 2.7, 3.2, 4.3), 'mirror');
  {
    const p = NY.sideFrame(4).toWorld(2.55, 3.5);
    circ(p[0], p[1], 0.22, 'stool');
  }
  return o;
};
NY.OBS = NY.obstacles();

/*
 * Keep-out areas: places a shopper should not walk into even where there is room. Behind every salon counter
 * (the jeweller's side), behind the concierge desk, and the gap between the lounge sofa and the back wall.
 * Polygons in metres; the walk planner keeps the visitor out of them. Add a polygon to close off another spot.
 */
NY.noGo = function () {
  const o = [];
  const F = NY.SALON_FIX;
  NY.SIDES.forEach((id, k) => {
    if (id === 'foyer' || id === 'lounge') return;
    o.push({
      pts: rect(k, -L.salon.W / 2, F.counter.v1, L.salon.W / 2, WT + L.salon.D),
      why: 'behind the ' + id + ' counter',
    });
    o.push({
      pts: rect(k, -F.counter.u - 0.25, F.counter.v0 - 0.05, F.counter.u + 0.25, F.counter.v1),
      why: 'the ' + id + ' counter ends',
    });
  });
  o.push({ pts: rect(0, 2.2, 1.9, 3.0, 4.0), why: 'behind the concierge desk' });
  o.push({ pts: rect(4, -1.6, 4.4, 1.6, 5.55), why: 'the lounge sofa' });
  return o;
};
NY.NO_GO = NY.noGo();
