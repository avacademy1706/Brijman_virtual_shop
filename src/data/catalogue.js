// Sample catalogue, shelf merchandising, lens options and pricing (INR). Replace with the client's stock.
import { NY } from '../core/ny.js';

import './frames.js';

/* ---------- Colours ---------- */
const C = {
  jet: { n: 'Jet black', a: '#141414', sw: '#141414' },
  matte: { n: 'Matte black', a: '#262626', sw: '#2b2b2b', matte: true },
  havana: { n: 'Havana tortoise', a: '#ffffff', k: 'tort', sw: '#7a4520' },
  darkhav: { n: 'Dark havana', a: '#a08c80', k: 'tort', sw: '#4a3326' },
  honey: { n: 'Honey tortoise', a: '#ffffff', k: 'tort', tl: true, sw: '#c68d44' },
  bottle: { n: 'Bottle green', a: '#1c4a3a', sw: '#1c4a3a' },
  navy: { n: 'Navy', a: '#1d2b4b', sw: '#1d2b4b' },
  olive: { n: 'Olive', a: '#58653a', sw: '#58653a' },
  burgundy: { n: 'Burgundy', a: '#6a1c2a', sw: '#6a1c2a' },
  ivory: { n: 'Ivory', a: '#eee3cf', sw: '#eee3cf' },
  blush: { n: 'Blush pink', a: '#e3ada7', sw: '#e3ada7' },
  crystal: { n: 'Crystal', a: '#eef3f4', k: 'clear', sw: '#dbe6e8' },
  greyx: { n: 'Grey crystal', a: '#8a9097', k: 'clear', sw: '#8a9097' },
  blushx: { n: 'Blush crystal', a: '#ecbcb6', k: 'clear', sw: '#ecbcb6' },
  gold: { n: 'Gold', m: '#d9b26b', sw: '#d9b26b' },
  silver: { n: 'Silver', m: '#cfd3d7', sw: '#cfd3d7' },
  gun: { n: 'Gunmetal', m: '#5b6067', sw: '#5b6067' },
  rose: { n: 'Rose gold', m: '#dea78f', sw: '#dea78f' },
  blackm: { n: 'Black', m: '#303033', sw: '#303033' },
  pall: { n: 'Palladium', m: '#babdc0', sw: '#babdc0' },
  gold18: { n: '18K gold', m: '#e6bd68', sw: '#e6bd68' },
  sky: { n: 'Sky blue', a: '#5fa9dc', sw: '#5fa9dc' },
  coral: { n: 'Coral', a: '#e2775a', sw: '#e2775a' },
  sunflower: { n: 'Sunflower', a: '#f0bf4c', sw: '#f0bf4c' },
  red: { n: 'Fire red', a: '#c5403a', sw: '#c5403a' },
  lime: { n: 'Lime', a: '#98c23c', sw: '#98c23c' },
  lilac: { n: 'Lilac', a: '#b59fd9', sw: '#b59fd9' },
  mint: { n: 'Mint', a: '#8ed1bf', sw: '#8ed1bf' },
  tangerine: { n: 'Tangerine', a: '#ee8848', sw: '#ee8848' },
};
const LT = {
  grey: { l: '#33373a', ln: 'Grey' },
  green: { l: '#3c4d36', ln: 'G-15 green' },
  brown: { l: '#5a3a24', ln: 'Brown' },
  blueM: { l: '#3d6fd4', lk: 'mirror', ln: 'Blue mirror' },
  goldM: { l: '#c99a3a', lk: 'mirror', ln: 'Gold mirror' },
  rose: { l: '#a86666', ln: 'Rose' },
  sage: { l: '#4a6a4a', ln: 'Green' },
};
const sunC = (frame, lens) =>
  Object.assign({}, frame, { l: lens.l, lk: lens.lk, n: frame.n + ' · ' + lens.ln + ' lens' });
const combo = (ace, met) => ({
  n: ace.n.replace(' tortoise', '') + ' · ' + met.n,
  a: ace.a,
  k: ace.k,
  tl: ace.tl,
  matte: ace.matte,
  m: met.m,
  sw: ace.sw,
  sw2: met.sw,
});

/* ---------- Catalogue (sample) ---------- */
const P = [];
function F(id, name, zone, arch, mat, price, size, weight, colors, desc, extra) {
  P.push(
    Object.assign(
      { id, name, zone, arch, mat, price, size, weight, colors, desc, type: 'frame', tags: [] },
      extra || {},
    ),
  );
}
function K(id, name, type, color, packs, desc, tags) {
  P.push({ id, name, zone: 'contacts', type, color, packs, desc, tags: tags || [] });
}
// Men
F(
  'm01',
  'Arlo',
  'men',
  'rectA',
  'Acetate',
  2490,
  [53, 18, 145],
  24,
  [C.jet, C.havana, C.bottle],
  'A slim everyday rectangle in polished acetate with five-barrel hinges.',
  { tags: ['Bestseller'] },
);
F(
  'm02',
  'Brook',
  'men',
  'squareA',
  'Acetate',
  2990,
  [54, 19, 145],
  28,
  [C.matte, C.navy, C.havana],
  'A bold square with thick rims and a flat top line.',
);
F(
  'm03',
  'Cove',
  'men',
  'roundM',
  'Titanium',
  3490,
  [49, 21, 145],
  14,
  [C.gold, C.gun],
  'Feather-light round titanium wire with adjustable nose pads.',
  { tags: ['Titanium'] },
);
F(
  'm04',
  'Drift',
  'men',
  'rectM',
  'Stainless steel',
  2790,
  [55, 17, 145],
  18,
  [C.gun, C.silver, C.blackm],
  'A narrow metal rectangle with spring hinges, a clean choice for work.',
);
F(
  'm05',
  'Elm',
  'men',
  'browC',
  'Acetate and metal',
  3290,
  [51, 20, 145],
  22,
  [combo(C.jet, C.gold), combo(C.havana, C.silver)],
  'Browline with an acetate brow over a fine metal lower rim.',
);
F(
  'm06',
  'Flint',
  'men',
  'geoM',
  'Titanium',
  3690,
  [50, 20, 145],
  15,
  [C.gun, C.gold],
  'Hexagonal titanium frame with a double-polished finish.',
  { tags: ['Titanium'] },
);
F(
  'm07',
  'Grove',
  'men',
  'rectA',
  'TR90',
  1790,
  [54, 17, 140],
  16,
  [C.matte, C.greyx],
  'Flexible TR90 rectangle that bends and springs back into shape.',
  { tags: ['Flexible'] },
);
F(
  'm08',
  'Haven',
  'men',
  'ovalM',
  'Stainless steel',
  2190,
  [52, 18, 140],
  17,
  [C.silver, C.gun],
  'A soft oval in brushed steel with spring hinges.',
);
F(
  'm09',
  'Indus',
  'men',
  'roundA',
  'Acetate',
  2690,
  [49, 21, 145],
  23,
  [C.havana, C.jet],
  'A classic acetate round with a keyhole bridge.',
);
F(
  'm10',
  'Jasper',
  'men',
  'ovalA',
  'Acetate',
  2390,
  [52, 18, 145],
  22,
  [C.navy, C.greyx],
  'A rounded oval in deep navy or smoke crystal.',
);
F(
  'm11',
  'Kabir',
  'men',
  'rectM',
  'Titanium',
  3890,
  [54, 18, 145],
  13,
  [C.blackm, C.gold],
  'Ultra-light titanium rectangle with flexible temples.',
  { tags: ['Titanium'] },
);
F(
  'm12',
  'Loch',
  'men',
  'rectA',
  'Acetate',
  2290,
  [52, 19, 145],
  21,
  [C.olive, C.crystal],
  'A mid-width rectangle in olive or clear crystal acetate.',
  { tags: ['New'] },
);
// Women
F(
  'w01',
  'Mira',
  'women',
  'cateyeA',
  'Acetate',
  2890,
  [52, 17, 140],
  22,
  [C.havana, C.burgundy, C.jet],
  'An upswept cat-eye with a bold outer corner.',
  { tags: ['Bestseller'] },
);
F(
  'w02',
  'Nila',
  'women',
  'roundA',
  'Acetate',
  2490,
  [48, 20, 140],
  20,
  [C.blushx, C.honey, C.ivory],
  'A petite round in soft crystal and honey tones.',
);
F(
  'w03',
  'Opal',
  'women',
  'oversizeA',
  'Acetate',
  3190,
  [55, 16, 140],
  27,
  [C.jet, C.olive, C.honey],
  'An oversized square that frames the face.',
);
F(
  'w04',
  'Pari',
  'women',
  'cateyeM',
  'Stainless steel',
  3390,
  [52, 17, 140],
  15,
  [C.rose, C.gold],
  'A fine-wire cat-eye in rose gold or gold.',
);
F(
  'w05',
  'Quill',
  'women',
  'geoM',
  'Titanium',
  3590,
  [51, 19, 140],
  14,
  [C.rose, C.silver],
  'Geometric titanium with a light, open profile.',
  { tags: ['Titanium'] },
);
F(
  'w06',
  'Rhea',
  'women',
  'ovalA',
  'Acetate',
  2290,
  [51, 18, 140],
  20,
  [C.blush, C.bottle, C.crystal],
  'An easy oval in blush, bottle green or crystal.',
);
F(
  'w07',
  'Sana',
  'women',
  'rectA',
  'Acetate',
  1990,
  [51, 17, 140],
  19,
  [C.navy, C.blushx],
  'A slim rectangle for everyday wear.',
);
F(
  'w08',
  'Tara',
  'women',
  'roundM',
  'Stainless steel',
  2690,
  [48, 20, 140],
  13,
  [C.rose, C.gold],
  'A delicate round wire with adjustable pads.',
);
F(
  'w09',
  'Uma',
  'women',
  'rectA',
  'Acetate',
  2590,
  [52, 17, 140],
  21,
  [C.burgundy, C.havana],
  'A soft rectangle with rounded corners.',
  { tags: ['New'] },
);
F(
  'w10',
  'Veda',
  'women',
  'oversizeA',
  'Acetate',
  2990,
  [54, 17, 140],
  25,
  [C.ivory, C.blushx],
  'A large square in ivory or blush crystal.',
);
// Sunglasses
F(
  's01',
  'Kite',
  'sun',
  'aviatorM',
  'Stainless steel',
  3990,
  [58, 14, 140],
  26,
  [sunC(C.gold, LT.green), sunC(C.silver, LT.blueM), sunC(C.gun, LT.grey)],
  'A teardrop aviator with a double bridge and polarised lenses.',
  { sun: true, polar: true, tags: ['Polarised', 'Bestseller'] },
);
F(
  's02',
  'Laguna',
  'sun',
  'squareA',
  'Acetate',
  3490,
  [55, 18, 145],
  30,
  [sunC(C.jet, LT.grey), sunC(C.havana, LT.brown)],
  'Chunky square sunglasses with polarised lenses.',
  { sun: true, polar: true, tags: ['Polarised'] },
);
F(
  's03',
  'Marina',
  'sun',
  'cateyeA',
  'Acetate',
  3290,
  [56, 17, 140],
  27,
  [sunC(C.jet, LT.grey), sunC(C.honey, LT.brown)],
  'A wide cat-eye with UV400 lenses.',
  { sun: true },
);
F(
  's04',
  'Noor',
  'sun',
  'roundM',
  'Stainless steel',
  2990,
  [50, 22, 145],
  18,
  [sunC(C.gold, LT.brown), sunC(C.silver, LT.grey)],
  'Round metal sunglasses with tinted UV400 lenses.',
  { sun: true },
);
F(
  's05',
  'Orbit',
  'sun',
  'geoM',
  'Stainless steel',
  3790,
  [52, 20, 145],
  20,
  [sunC(C.gold, LT.goldM), sunC(C.gun, LT.grey)],
  'Hexagonal sunglasses with mirrored, polarised lenses.',
  { sun: true, polar: true, tags: ['Polarised'] },
);
F(
  's06',
  'Palm',
  'sun',
  'rectA',
  'TR90',
  2690,
  [56, 16, 140],
  22,
  [sunC(C.matte, LT.blueM), sunC(C.olive, LT.green)],
  'A light rectangle for driving and travel.',
  { sun: true, polar: true, tags: ['Polarised'] },
);
F(
  's07',
  'Ravi',
  'sun',
  'browC',
  'Acetate and metal',
  3590,
  [52, 20, 145],
  24,
  [sunC(combo(C.havana, C.gold), LT.green), sunC(combo(C.jet, C.silver), LT.grey)],
  'Browline sunglasses with polarised G-15 lenses.',
  { sun: true, polar: true, tags: ['Polarised'] },
);
F(
  's08',
  'Sol',
  'sun',
  'ovalM',
  'Stainless steel',
  2490,
  [51, 19, 140],
  16,
  [sunC(C.gold, LT.rose), sunC(C.silver, LT.sage)],
  'Small oval sunglasses with tinted lenses.',
  { sun: true },
);
// Kids
F(
  'k01',
  'Pip',
  'kids',
  'roundA',
  'TR90',
  1290,
  [44, 16, 125],
  12,
  [C.sky, C.coral, C.sunflower],
  'A flexible round for ages 4 to 8, with soft temple tips.',
  { kids: true, tags: ['Flexible'] },
);
F(
  'k02',
  'Bolt',
  'kids',
  'rectA',
  'TR90',
  1390,
  [46, 15, 125],
  13,
  [C.navy, C.red, C.lime],
  'A sturdy rectangle with spring hinges, for ages 6 to 12.',
  { kids: true, tags: ['Flexible'] },
);
F('k03', 'Moon', 'kids', 'ovalA', 'TR90', 1190, [42, 16, 120], 11, [C.lilac, C.mint], 'A small oval for ages 3 to 6.', {
  kids: true,
});
F(
  'k04',
  'Zip',
  'kids',
  'squareA',
  'TR90',
  1490,
  [47, 16, 130],
  14,
  [C.jet, C.tangerine],
  'A square frame for ages 8 to 12.',
  { kids: true },
);
F(
  'k05',
  'Sunny',
  'kids',
  'roundA',
  'TR90',
  1290,
  [44, 16, 125],
  12,
  [sunC(C.sunflower, LT.grey), sunC(C.coral, LT.brown)],
  'Kids’ polarised sunglasses with UV400 lenses.',
  { kids: true, sun: true, polar: true, tags: ['Polarised'] },
);
// Atelier premium
F(
  'p01',
  'Aurum',
  'premium',
  'roundM',
  'Beta titanium, 18K gold plated',
  14900,
  [48, 22, 145],
  12,
  [C.gold18, C.pall],
  'A hand-finished round in beta titanium with 18K gold plating.',
  { tags: ['Atelier', 'Titanium'] },
);
F(
  'p02',
  'Noir',
  'premium',
  'squareA',
  'Italian acetate',
  11900,
  [53, 20, 145],
  30,
  [C.jet, C.darkhav],
  'Hand-polished thick acetate square with seven-barrel hinges.',
  { tags: ['Atelier'] },
);
F(
  'p03',
  'Seraph',
  'premium',
  'cateyeA',
  'Italian acetate',
  12900,
  [53, 17, 140],
  26,
  [C.jet, C.burgundy],
  'A sculpted cat-eye cut from a single acetate block.',
  { tags: ['Atelier'] },
);
F(
  'p04',
  'Atlas',
  'premium',
  'aviatorM',
  'Titanium',
  16900,
  [58, 14, 145],
  22,
  [sunC(C.gold18, LT.green), sunC(C.pall, LT.grey)],
  'A titanium aviator with polarised mineral-glass lenses.',
  { sun: true, polar: true, tags: ['Atelier', 'Polarised'] },
);
F(
  'p05',
  'Vela',
  'premium',
  'geoM',
  'Titanium',
  13900,
  [50, 20, 145],
  13,
  [C.rose, C.gold],
  'A faceted titanium geometric with a satin finish.',
  { tags: ['Atelier', 'Titanium'] },
);
F(
  'p06',
  'Ember',
  'premium',
  'browC',
  'Acetate and titanium',
  10900,
  [51, 21, 145],
  21,
  [combo(C.havana, C.gold), combo(C.jet, C.gold)],
  'A browline with a titanium lower rim and a hand-polished brow.',
  { tags: ['Atelier'] },
);
// Contacts and care
K(
  'c01',
  'Nayan Daily 1-Day',
  'contacts',
  '#3f88c5',
  [
    { n: '30 lenses', p: 1450 },
    { n: '90 lenses', p: 3950 },
  ],
  'Daily disposable silicone hydrogel lenses. A fresh pair every day.',
  ['Daily'],
);
K(
  'c02',
  'Nayan Monthly Comfort',
  'contacts',
  '#2f9a7f',
  [
    { n: '6 lenses', p: 1350 },
    { n: '3 lenses', p: 750 },
  ],
  'Monthly lenses with a moisture-retaining surface.',
  ['Monthly'],
);
K(
  'c03',
  'Nayan Toric Daily',
  'contacts',
  '#8b5fbf',
  [{ n: '30 lenses', p: 2150 }],
  'Daily lenses that correct astigmatism.',
  ['Toric'],
);
K(
  'c04',
  'Nayan Colour Tones',
  'contacts',
  '#c56b4f',
  [
    { n: '2 lenses, hazel', p: 1200 },
    { n: '2 lenses, grey', p: 1200 },
    { n: '2 lenses, blue', p: 1200 },
  ],
  'Monthly coloured lenses, with or without power.',
  ['Coloured'],
);
K(
  'c05',
  'All-in-One Solution',
  'care',
  '#2c7fb8',
  [
    { n: '360 ml', p: 550 },
    { n: '120 ml travel', p: 240 },
  ],
  'Cleans, rinses and stores soft contact lenses.',
);
K('c06', 'Comfort Drops', 'care', '#58a6a6', [{ n: '10 ml', p: 350 }], 'Lubricating drops for dry or tired eyes.');
K(
  'c07',
  'Lens Case Kit',
  'care',
  '#e0a73d',
  [{ n: 'Kit', p: 250 }],
  'Two cases, tweezers and a mirror in a travel pouch.',
);
NY.PRODUCTS = P;
NY.byId = {};
P.forEach((p) => {
  NY.byId[p.id] = p;
});

/* Which product sits on which shelf (lowest shelf first). */
NY.MERCH = {
  men: [
    ['m03', 'm04', 'm11', 'm08'],
    ['m07', 'm01', 'm02', 'm12'],
    ['m10', 'm09', 'm05', 'm06'],
  ],
  women: [
    ['w08', 'w05', 'w04', 'w07'],
    ['w06', 'w02', 'w01', 'w09'],
    ['w10', 'w03', 'w01', 'w03'],
  ],
  sun: [
    ['s01', 's02'],
    ['s03', 's04'],
    ['s05', 's06'],
    ['s07', 's08'],
  ],
  kidsWall: ['k03', 'k01', 'k02'],
  kidsTable: ['k04', 'k05'],
  premiumCases: [
    ['p01', 0],
    ['p02', 0],
    ['p03', 0],
    ['p04', 0],
  ],
  premiumNiche: [
    ['p05', 0],
    ['p05', 1],
    ['p06', 0],
    ['p06', 1],
    ['p03', 1],
    ['p04', 1],
  ],
  contacts: [
    ['c05', 'c06', 'c07'],
    ['c01', 'c02', 'c03'],
    ['c04', 'c03', 'c01'],
  ],
  contactsTable: ['c01', 'c04'],
};

/* ---------- Lenses and pricing ---------- */
NY.LENS = {
  types: [
    { id: 'zero', n: 'Zero power', d: 'No prescription. Anti-glare lenses for screens or style.', p: 0 },
    { id: 'sv', n: 'Single vision', d: 'One power, for distance or for reading.', p: 1200 },
    { id: 'bf', n: 'Bifocal', d: 'Distance on top with a reading segment below.', p: 2400 },
    { id: 'pg', n: 'Progressive', d: 'Distance, intermediate and near in one lens, with no visible line.', p: 4900 },
  ],
  index: [
    { id: '156', n: '1.56 Standard', d: 'Good for low powers.', p: 0 },
    { id: '160', n: '1.60 Thin', d: 'About 7% thinner than 1.56.', p: 900 },
    { id: '167', n: '1.67 Extra thin', d: 'About 16% thinner. Suits powers above ±4.00.', p: 2200 },
    { id: '174', n: '1.74 Ultra thin', d: 'About 24% thinner. For high powers.', p: 4500 },
  ],
  coats: [
    { id: 'ag', n: 'Anti-glare and scratch guard', d: 'Included on every lens.', p: 0, fixed: true },
    { id: 'bc', n: 'Blue-cut filter', d: 'Filters part of the blue light from screens.', p: 900 },
    { id: 'ph', n: 'Photochromic', d: 'Darkens outdoors and clears indoors.', p: 1900 },
  ],
  sun: [
    { id: 'plano', n: 'Non-prescription UV400', d: 'The lenses shown on the frame.', p: 0 },
    { id: 'rxsun', n: 'Prescription sun lenses', d: 'The same tint, made to your power.', p: 2900 },
  ],
  rx: [
    { id: 'later', n: 'Add it after ordering', d: 'Share a photo of your prescription later.' },
    { id: 'now', n: 'Enter it now', d: 'Type the values from your prescription.' },
    { id: 'test', n: 'Book a free eye test first', d: 'We hold the frame until your test.' },
  ],
};
NY.colorOf = (p, ci) =>
  p.colors ? p.colors[(((ci || 0) % p.colors.length) + p.colors.length) % p.colors.length] : null;
NY.lensRules = (p) => {
  if (p.type !== 'frame') return null;
  if (p.sun) return { mode: 'sun' };
  const kids = p.zone === 'kids';
  return {
    mode: 'optical',
    types: kids ? ['zero', 'sv'] : ['zero', 'sv', 'bf', 'pg'],
    index: kids ? ['156', '160'] : ['156', '160', '167', '174'],
  };
};
NY.defaultCfg = (p) => {
  if (p.type !== 'frame') return { pack: 0 };
  if (p.sun) return { sunlens: 'plano', rx: 'later' };
  return { type: 'zero', index: '156', coats: [], rx: 'later' };
};
NY.needsRx = (p, cfg) => p.type === 'frame' && (p.sun ? cfg.sunlens === 'rxsun' : cfg.type !== 'zero');
NY.needsAdd = (p, cfg) => p.type === 'frame' && !p.sun && (cfg.type === 'bf' || cfg.type === 'pg');
NY.priceOf = (p, cfg) => {
  if (p.type !== 'frame') return p.packs[cfg.pack || 0].p;
  let t = p.price;
  if (p.sun) return t + (cfg.sunlens === 'rxsun' ? 2900 : 0);
  const ty = NY.LENS.types.find((x) => x.id === cfg.type) || NY.LENS.types[0];
  t += ty.p;
  if (cfg.type !== 'zero') {
    const ix = NY.LENS.index.find((x) => x.id === cfg.index);
    if (ix) t += ix.p;
  }
  for (const c of cfg.coats || []) {
    const co = NY.LENS.coats.find((x) => x.id === c);
    if (co) t += co.p;
  }
  return t;
};
NY.cfgSummary = (p, cfg) => {
  if (p.type !== 'frame') return p.packs[cfg.pack || 0].n;
  const parts = [];
  if (p.sun)
    parts.push(cfg.sunlens === 'rxsun' ? 'Prescription sun lenses' : 'UV400 lenses' + (p.polar ? ', polarised' : ''));
  else {
    const ty = NY.LENS.types.find((x) => x.id === cfg.type);
    parts.push(ty ? ty.n : 'Zero power');
    if (cfg.type !== 'zero') {
      const ix = NY.LENS.index.find((x) => x.id === cfg.index);
      if (ix) parts.push(ix.n);
    }
    for (const c of cfg.coats || []) {
      const co = NY.LENS.coats.find((x) => x.id === c);
      if (co) parts.push(co.n);
    }
  }
  if (NY.needsRx(p, cfg))
    parts.push(
      cfg.rx === 'now' ? 'Prescription entered' : cfg.rx === 'test' ? 'Eye test first' : 'Prescription to follow',
    );
  return parts.join(' · ');
};
