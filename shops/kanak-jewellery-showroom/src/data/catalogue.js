// Catalogue: metals and today's rates, size charts, stone prices, every product with its 3D build spec, how
// prices are worked out, and which piece sits where in the boutique. Plain data, loads in the browser and in Node.
import { NY } from '../core/ny.js';

/* =====================================================================
   SAMPLE DATA. Replace the rates, prices and products with the client's own.
   ===================================================================== */

/** Metal rates in rupees per gram (sample values; update daily). Gold is quoted for 24K. */
NY.RATES = {
  label: 'Sample rates for this demo',
  gold24: 12400,
  platinum: 3650,
  silver: 148,
  gstPct: 3,
};

/** Metals: purity, density (g/cm3, for weight when the metal changes) and the rate they use. */
NY.METAL = {
  y22: {
    n: '22K yellow gold',
    short: '22K Yellow',
    purity: 0.916,
    density: 17.7,
    rate: 'gold',
    mark: '22K916',
    swatch: '#e8b44f',
  },
  ant: {
    n: '22K antique gold',
    short: '22K Antique',
    purity: 0.916,
    density: 17.7,
    rate: 'gold',
    mark: '22K916',
    swatch: '#c08f3e',
  },
  y18: {
    n: '18K yellow gold',
    short: '18K Yellow',
    purity: 0.75,
    density: 15.5,
    rate: 'gold',
    mark: '18K750',
    swatch: '#efcb7b',
  },
  r18: {
    n: '18K rose gold',
    short: '18K Rose',
    purity: 0.75,
    density: 15.0,
    rate: 'gold',
    mark: '18K750',
    swatch: '#e9ae95',
  },
  w18: {
    n: '18K white gold',
    short: '18K White',
    purity: 0.75,
    density: 15.8,
    rate: 'gold',
    mark: '18K750',
    swatch: '#dcdad4',
  },
  pt: {
    n: 'Platinum 950',
    short: 'Platinum',
    purity: 0.95,
    density: 20.5,
    rate: 'platinum',
    mark: 'Pt950',
    swatch: '#cfcecb',
  },
  ag: {
    n: 'Sterling silver 925',
    short: 'Silver',
    purity: 0.925,
    density: 10.4,
    rate: 'silver',
    mark: '925',
    swatch: '#e4e3df',
  },
};
NY.metalRate = (key) => {
  const m = NY.METAL[key];
  if (m.rate === 'platinum') return NY.RATES.platinum;
  if (m.rate === 'silver') return NY.RATES.silver;
  return NY.RATES.gold24 * m.purity;
};

/** Stones: name, rupees per carat (pearls: per piece), and the colour shown on swatches. */
NY.STONE = {
  diamond: { n: 'Diamond', perCt: 62000, swatch: '#eef3f6', certified: 'IGI' },
  polki: { n: 'Polki', perCt: 34000, swatch: '#efe9dc' },
  kundan: { n: 'Kundan', perPiece: 180, swatch: '#f3e6c4' },
  ruby: { n: 'Ruby', perCt: 18000, swatch: '#b0122d' },
  emerald: { n: 'Emerald', perCt: 16500, swatch: '#0f7a48' },
  sapphire: { n: 'Blue sapphire', perCt: 22000, swatch: '#1b3c9c' },
  pink: { n: 'Pink sapphire', perCt: 12000, swatch: '#e46e98' },
  yellow: { n: 'Yellow sapphire', perCt: 12500, swatch: '#f0c330' },
  onyx: { n: 'Black onyx', perCt: 400, swatch: '#151515' },
  coral: { n: 'Red coral', perCt: 2500, swatch: '#d4553b' },
  hessonite: { n: 'Hessonite', perCt: 3500, swatch: '#c9701e' },
  cat: { n: 'Cat’s eye', perCt: 6000, swatch: '#b59a48' },
  amethyst: { n: 'Amethyst', perCt: 1800, swatch: '#8a46c4' },
  pearl: { n: 'Freshwater pearl', perPiece: 420, swatch: '#f3eee4' },
  southsea: { n: 'South Sea pearl', perPiece: 5200, swatch: '#f1e4c8' },
};
/** Solitaire price per carat grows with the carat weight. */
NY.solitairePerCt = (ct) => (ct < 0.4 ? 78000 : ct < 0.65 ? 105000 : ct < 0.9 ? 128000 : ct < 1.3 ? 165000 : 210000);
NY.QUALITY = [
  { id: 'efvvs', n: 'EF · VVS', d: 'Colourless, very very slightly included', f: 1.35 },
  { id: 'ghvs', n: 'GH · VS', d: 'Near colourless, very slightly included', f: 1 },
  { id: 'ijsi', n: 'IJ · SI', d: 'Faint warmth, slightly included', f: 0.72 },
];

/* ---------- Size charts ---------- */
// Indian ring sizes: inner diameter in mm (sample chart; confirm with the store's ring sizer)
NY.RING_SIZES = [
  [5, 14.9],
  [6, 15.3],
  [7, 15.6],
  [8, 15.9],
  [9, 16.2],
  [10, 16.5],
  [11, 16.9],
  [12, 17.2],
  [13, 17.5],
  [14, 17.8],
  [15, 18.1],
  [16, 18.5],
  [17, 18.8],
  [18, 19.1],
  [19, 19.4],
  [20, 19.7],
  [21, 20.0],
  [22, 20.4],
  [23, 20.7],
  [24, 21.0],
];
// Bangle sizes: inner diameter in mm
NY.BANGLE_SIZES = [
  ['2.2', 54.0],
  ['2.4', 57.2],
  ['2.6', 60.3],
  ['2.8', 63.5],
  ['2.10', 66.7],
];
// Chain and necklace lengths in inches
NY.CHAIN_LENGTHS = [14, 16, 18, 20, 22, 24, 28];
// Bracelet sizes: wrist circumference in mm
NY.WRIST_SIZES = [
  ['S', 150],
  ['M', 165],
  ['L', 180],
  ['XL', 195],
];

/* =====================================================================
   PRODUCTS
   ===================================================================== */
const P = [];
const D = (o) => {
  const p = Object.assign(
    {
      gender: 'women',
      tags: [],
      stones: [],
      making: 0.14,
      quality: false,
      whiteClaws: false,
    },
    o,
  );
  p.metal = p.metal || p.metals[0];
  P.push(p);
  return p;
};
const dia = (ct, n, role, cut) => ({ role: role || 'accent', kind: 'diamond', ct, n: n || 1, cut: cut || 'round' });

/* ---------- Solitaires & Rings ---------- */
D({
  id: 's01',
  name: 'Aarohi Solitaire',
  zone: 'solitaire',
  type: 'ring',
  cat: 'Engagement ring',
  metals: ['pt', 'w18', 'y18', 'r18'],
  wt: 3.4,
  making: 0.16,
  quality: true,
  whiteClaws: true,
  caratOptions: [0.3, 0.5, 0.75, 1, 1.5],
  carat: 0.5,
  sizes: 'ring',
  stones: [{ role: 'main', kind: 'diamond', ct: 0.5, n: 1, cut: 'round', solitaire: true }],
  build: { type: 'ring', head: 'solitaire', cut: 'round', prongs: 6, band: 'D', thick: 1.7, width: 2.1 },
  tags: ['Solitaire', 'Engagement', 'IGI certified'],
  desc: 'A round brilliant raised on six slender claws and a cathedral basket, so light reaches the stone from every side. Comfort-fit band.',
  tryon: 'finger',
});
D({
  id: 's02',
  name: 'Noor Halo Ring',
  zone: 'solitaire',
  type: 'ring',
  cat: 'Engagement ring',
  metals: ['w18', 'pt', 'y18', 'r18'],
  wt: 3.9,
  making: 0.18,
  quality: true,
  whiteClaws: true,
  caratOptions: [0.3, 0.5, 0.75, 1],
  carat: 0.5,
  sizes: 'ring',
  stones: [
    { role: 'main', kind: 'diamond', ct: 0.5, n: 1, cut: 'round', solitaire: true },
    dia(0.012, 26),
    dia(0.01, 16),
  ],
  build: { type: 'ring', head: 'halo', cut: 'round', prongs: 4, band: 'D', thick: 1.6, width: 2.0, pave: true },
  tags: ['Halo', 'Engagement', 'Pavé'],
  desc: 'A halo of brilliant-cut diamonds frames the centre stone and makes it look a size larger. Pavé diamonds run down both shoulders.',
  tryon: 'finger',
});
D({
  id: 's03',
  name: 'Tara Three-Stone',
  zone: 'solitaire',
  type: 'ring',
  cat: 'Engagement ring',
  metals: ['pt', 'y18', 'w18', 'r18'],
  wt: 4.2,
  making: 0.16,
  quality: true,
  whiteClaws: true,
  caratOptions: [0.5, 0.75, 1],
  carat: 0.75,
  sizes: 'ring',
  stones: [
    { role: 'main', kind: 'diamond', ct: 0.75, n: 1, cut: 'oval', solitaire: true },
    { role: 'side', kind: 'diamond', ct: 0.2, n: 2, cut: 'round' },
  ],
  build: { type: 'ring', head: 'three', cut: 'oval', band: 'D', thick: 1.8, width: 2.3 },
  tags: ['Three stone', 'Oval'],
  desc: 'Past, present and future: an oval centre flanked by two round brilliants, each in its own four-claw setting.',
  tryon: 'finger',
});
D({
  id: 's04',
  name: 'Rajkumari Princess',
  zone: 'solitaire',
  type: 'ring',
  cat: 'Engagement ring',
  metals: ['pt', 'w18', 'y18'],
  wt: 3.6,
  making: 0.16,
  quality: true,
  whiteClaws: true,
  caratOptions: [0.5, 0.75, 1, 1.5],
  carat: 0.75,
  sizes: 'ring',
  stones: [{ role: 'main', kind: 'diamond', ct: 0.75, n: 1, cut: 'princess', solitaire: true }],
  build: { type: 'ring', head: 'solitaire', cut: 'princess', prongs: 4, band: 'knife', thick: 1.8, width: 2.2 },
  tags: ['Princess cut', 'Knife edge'],
  desc: 'A square princess cut held at its four corners on a knife-edge band that catches a line of light.',
  tryon: 'finger',
});
D({
  id: 's05',
  name: 'Anant Eternity Band',
  zone: 'solitaire',
  type: 'ring',
  cat: 'Band',
  metals: ['pt', 'w18', 'y18', 'r18'],
  wt: 3.1,
  making: 0.18,
  quality: true,
  whiteClaws: false,
  sizes: 'ring',
  stones: [dia(0.045, 24, 'main')],
  build: { type: 'ring', head: 'eternity', stoneMM: 2.25, band: 'flat', thick: 1.7, width: 2.6 },
  tags: ['Eternity', 'Wedding band'],
  desc: 'Diamonds all the way round, shared claws between each stone. The classic anniversary band.',
  tryon: 'finger',
});
D({
  id: 's06',
  name: 'Vaibhav Men’s Band',
  zone: 'solitaire',
  type: 'ring',
  cat: 'Men’s ring',
  gender: 'men',
  metals: ['pt', 'y18', 'w18'],
  wt: 7.8,
  making: 0.12,
  quality: true,
  sizes: 'ring',
  defaultSize: 20,
  stones: [{ role: 'main', kind: 'diamond', ct: 0.15, n: 1, cut: 'round' }],
  build: { type: 'ring', head: 'flush', stoneMM: 3.4, band: 'flat', thick: 2.2, width: 6.0, headT: 0, headW: 0 },
  tags: ['Men', 'Flush set', 'Platinum'],
  desc: 'A wide, flat band with a single diamond set flush into the metal: nothing to catch, nothing to snag.',
  tryon: 'finger',
});
D({
  id: 's07',
  name: 'Sitara Cluster Ring',
  zone: 'solitaire',
  type: 'ring',
  cat: 'Cocktail ring',
  metals: ['w18', 'y18', 'r18'],
  wt: 3.8,
  making: 0.18,
  quality: true,
  whiteClaws: true,
  sizes: 'ring',
  stones: [{ role: 'main', kind: 'diamond', ct: 0.25, n: 1, cut: 'round' }, dia(0.14, 6, 'accent', 'round')],
  build: { type: 'ring', head: 'cluster', stoneMM: 4.1, band: 'D', thick: 1.7, width: 2.0, pave: true },
  tags: ['Cluster', 'Flower'],
  desc: 'Seven diamonds gathered into a flower, so the ring reads as one large stone at a fraction of the price.',
  tryon: 'finger',
});

/* ---------- Diamond Atelier ---------- */
D({
  id: 'd01',
  name: 'Ganga Riviera Necklace',
  zone: 'diamond',
  type: 'necklace',
  cat: 'Necklace',
  metals: ['w18', 'y18', 'pt'],
  wt: 21,
  making: 0.2,
  quality: true,
  sizes: 'chain',
  defaultSize: 16,
  stones: [dia(0.18, 24, 'main'), { role: 'main', kind: 'diamond', ct: 1.0, n: 1, cut: 'pear' }],
  build: {
    type: 'necklace',
    style: 'riviera',
    count: 25,
    motifMM: 9.5,
    span: 0.42,
    centre: true,
    centreCut: 'pear',
    link: 1.8,
  },
  tags: ['Riviera', 'Graduated', 'Statement'],
  desc: 'Twenty-five diamonds in round collets, graduated towards a pear-shaped centre. Flexible links let it lie flat on the collarbone.',
  tryon: 'neck',
});
D({
  id: 'd02',
  name: 'Phool Diamond Necklace',
  zone: 'diamond',
  type: 'necklace',
  cat: 'Necklace',
  metals: ['y18', 'w18', 'r18'],
  wt: 26,
  making: 0.22,
  quality: true,
  sizes: 'chain',
  defaultSize: 16,
  stones: [dia(0.05, 13, 'main'), dia(0.03, 78, 'main', 'marquise')],
  build: { type: 'necklace', style: 'motifs', motif: 'cluster', count: 13, motifMM: 15, span: 0.34, link: 2 },
  tags: ['Floral', 'Cocktail', 'Bridal'],
  desc: 'Thirteen diamond flowers, each a round brilliant with six marquise petals, linked in a soft collar.',
  tryon: 'neck',
});
D({
  id: 'd03',
  name: 'Ojas Pear Drops',
  zone: 'diamond',
  type: 'earrings',
  cat: 'Drop earrings',
  metals: ['w18', 'y18', 'pt', 'r18'],
  wt: 3.2,
  making: 0.18,
  quality: true,
  whiteClaws: true,
  stones: [dia(0.4, 2, 'drop', 'pear'), dia(0.1, 2, 'accent')],
  build: { type: 'earrings', style: 'drop', topMM: 3.2, dropMM: 7.2, dropCut: 'pear', gap: 26 },
  tags: ['Pear', 'Drops'],
  desc: 'Pear-shaped diamonds that swing below a single round brilliant. Light, so they sit straight all evening.',
  tryon: 'ear',
});
D({
  id: 'd04',
  name: 'Chandni Tennis Bracelet',
  zone: 'diamond',
  type: 'bracelet',
  cat: 'Bracelet',
  metals: ['w18', 'y18', 'pt', 'r18'],
  wt: 11.5,
  making: 0.2,
  quality: true,
  sizes: 'wrist',
  stones: [dia(0.08, 52, 'main')],
  build: { type: 'bracelet', style: 'tennis', stoneMM: 2.8 },
  tags: ['Tennis', 'Line bracelet'],
  desc: 'A single line of matched diamonds, each in its own four-claw basket, closing with a hidden box clasp.',
  tryon: 'wrist',
});
D({
  id: 'd05',
  name: 'Kiran Diamond Bangle',
  zone: 'diamond',
  type: 'bangle',
  cat: 'Bangle',
  metals: ['y18', 'w18', 'r18'],
  wt: 18,
  making: 0.18,
  quality: true,
  sizes: 'bangle',
  stones: [dia(0.03, 72, 'main')],
  build: { type: 'bangle', style: 'channel', thick: 2.4, width: 3.6, stoneMM: 2.2 },
  tags: ['Channel set', 'Eternity'],
  desc: 'A slim bangle with a channel of diamonds all the way round. Stacks well with plain gold.',
  tryon: 'wrist',
});
D({
  id: 'd06',
  name: 'Moti Cluster Studs',
  zone: 'diamond',
  type: 'earrings',
  cat: 'Studs',
  metals: ['w18', 'y18', 'r18'],
  wt: 2.6,
  making: 0.18,
  quality: true,
  whiteClaws: true,
  stones: [dia(0.06, 2, 'main'), dia(0.04, 12, 'accent', 'marquise')],
  build: { type: 'earrings', style: 'cluster', stoneMM: 2.9, gap: 24 },
  tags: ['Cluster', 'Studs', 'Everyday'],
  desc: 'Flower studs of seven diamonds each: a round brilliant centre with six marquise petals.',
  tryon: 'ear',
});
D({
  id: 'd07',
  name: 'Nazakat Halo Pendant',
  zone: 'diamond',
  type: 'pendant',
  cat: 'Pendant',
  metals: ['w18', 'y18', 'r18', 'pt'],
  wt: 4.4,
  making: 0.18,
  quality: true,
  whiteClaws: true,
  sizes: 'chain',
  defaultSize: 18,
  stones: [dia(0.6, 1, 'main', 'pear'), dia(0.012, 26)],
  build: { type: 'pendant', style: 'chain', pendant: 'halo-drop', cut: 'pear', stoneMM: 7.6, link: 1.6 },
  tags: ['Pear', 'Halo', 'Pendant'],
  desc: 'A pear diamond in a halo of brilliants, on a fine cable chain. Includes the chain.',
  tryon: 'neck',
});

/* ---------- Polki & Kundan ---------- */
D({
  id: 'p01',
  name: 'Maharani Rani Haar',
  zone: 'polki',
  type: 'necklace',
  cat: 'Rani haar',
  metals: ['y22'],
  wt: 86,
  making: 0.18,
  sizes: 'chain',
  defaultSize: 22,
  stones: [
    { role: 'main', kind: 'polki', ct: 9.5, n: 1, cut: 'polki' },
    { role: 'accent', kind: 'diamond', ct: 0.02, n: 16 },
    { role: 'pearl', kind: 'pearl', n: 260 },
    { role: 'drop', kind: 'emerald', ct: 0.9, n: 4 },
    { kind: 'emerald', ct: 0.6, n: 70 },
  ],
  stoneOptions: { drop: ['emerald', 'ruby'] },
  build: {
    type: 'necklace',
    style: 'layered',
    strands: 3,
    step: 46,
    pearlR: 2.3,
    beads: 'emerald',
    centre: 'polki-oval',
    centreMM: 36,
    centreDrops: 7,
  },
  tags: ['Polki', 'Bridal', 'Signature', 'Pearls'],
  desc: 'Our signature piece: three strands of pearls and emerald beads meeting at a Mughal polki medallion with a fringe of emerald and pearl drops. Uncut diamonds, foil-backed the traditional way.',
  tryon: 'neck',
});
D({
  id: 'p02',
  name: 'Shahi Kundan Choker',
  zone: 'polki',
  type: 'necklace',
  cat: 'Choker',
  metals: ['y22'],
  wt: 54,
  making: 0.2,
  sizes: null,
  stones: [
    { role: 'main', kind: 'kundan', n: 13 },
    { role: 'accent', kind: 'ruby', ct: 0.08, n: 104 },
    { role: 'pearl', kind: 'pearl', n: 13 },
  ],
  stoneOptions: { accent: ['ruby', 'emerald'] },
  build: {
    type: 'necklace',
    style: 'choker',
    lengthIn: 14,
    motif: 'petal',
    count: 13,
    motifMM: 17,
    span: 0.4,
    accent: '@accent',
    drops: 'pearl',
    dropR: 1.8,
    back: 'dori',
    row2: 'collet',
  },
  tags: ['Kundan', 'Choker', 'Bridal', 'Dori'],
  desc: 'Kundan flowers set edge to edge around the neck, each with a ring of rubies and a pearl drop. Ties with a silk dori, so it fits any neck.',
  tryon: 'neck',
});
D({
  id: 'p03',
  name: 'Noorjahan Polki Chandbalis',
  zone: 'polki',
  type: 'earrings',
  cat: 'Chandbalis',
  metals: ['y22'],
  wt: 22,
  making: 0.2,
  stones: [
    { role: 'main', kind: 'polki', ct: 0.35, n: 20 },
    { role: 'accent', kind: 'diamond', ct: 0.01, n: 40 },
    { role: 'pearl', kind: 'pearl', n: 26 },
  ],
  build: { type: 'earrings', style: 'chandbali', size: 15, topMM: 9, drops: 13, gap: 44 },
  tags: ['Polki', 'Chandbali', 'Bridal'],
  desc: 'Moon-shaped chandbalis lined with uncut diamonds and edged with seed pearls, hanging from a polki flower top.',
  tryon: 'ear',
});
D({
  id: 'p04',
  name: 'Gulnar Kundan Tikka',
  zone: 'polki',
  type: 'tikka',
  cat: 'Maang tikka',
  metals: ['y22'],
  wt: 9.5,
  making: 0.2,
  stones: [
    { role: 'main', kind: 'polki', ct: 1.4, n: 1 },
    { role: 'accent', kind: 'diamond', ct: 0.015, n: 14 },
    { role: 'drop', kind: 'ruby', ct: 0.3, n: 1 },
    { role: 'pearl', kind: 'pearl', n: 5 },
  ],
  stoneOptions: { drop: ['ruby', 'emerald'] },
  build: { type: 'tikka', motif: 'polki-oval', motifMM: 22, chainMM: 52, drops: 5, bindi: true },
  tags: ['Maang tikka', 'Polki', 'Bridal'],
  desc: 'An oval polki medallion with a fringe of pearls and a ruby drop, on a fine chain that hooks into the hair.',
  tryon: 'forehead',
});
D({
  id: 'p05',
  name: 'Jadau Polki Bangles',
  zone: 'polki',
  type: 'bangle',
  cat: 'Bangles (pair)',
  metals: ['y22'],
  wt: 62,
  making: 0.2,
  sizes: 'bangle',
  stones: [
    { role: 'main', kind: 'polki', ct: 0.45, n: 28 },
    { role: 'accent', kind: 'ruby', ct: 0.06, n: 56 },
  ],
  stoneOptions: { accent: ['ruby', 'emerald'] },
  build: { type: 'bangle', style: 'polki', count: 2, thick: 3, width: 7, stones: 14, accent: '@accent', gapMM: 2 },
  tags: ['Polki', 'Jadau', 'Pair', 'Bridal'],
  desc: 'A pair of jadau bangles: fourteen polki flowers each, with rubies between the petals.',
  tryon: 'wrist',
});
D({
  id: 'p06',
  name: 'Mehr Kundan Nath',
  zone: 'polki',
  type: 'nath',
  cat: 'Nath',
  metals: ['y22'],
  wt: 4.2,
  making: 0.22,
  stones: [
    { role: 'main', kind: 'kundan', n: 1 },
    { role: 'accent', kind: 'ruby', ct: 0.3, n: 1 },
    { role: 'pearl', kind: 'pearl', n: 6 },
  ],
  build: { type: 'nath', size: 16, deco: 'bridal' },
  tags: ['Nath', 'Bridal', 'Kundan'],
  desc: 'A bridal nose ring with a kundan flower, a ruby bead and pearls along the lower arc.',
  tryon: 'nose',
});
D({
  id: 'p07',
  name: 'Zeenat Polki Ring',
  zone: 'polki',
  type: 'ring',
  cat: 'Cocktail ring',
  metals: ['y22'],
  wt: 7.4,
  making: 0.2,
  sizes: 'ring',
  stones: [
    { role: 'main', kind: 'polki', ct: 1.1, n: 1 },
    { role: 'accent', kind: 'ruby', ct: 0.05, n: 8 },
  ],
  stoneOptions: { accent: ['ruby', 'emerald'] },
  build: { type: 'ring', head: 'polki', stoneMM: 9, band: 'D', thick: 1.8, width: 2.6 },
  tags: ['Polki', 'Cocktail'],
  desc: 'A polki flower ring: the uncut diamond sits in a gold collet surrounded by eight small rubies.',
  tryon: 'finger',
});

/* ---------- Temple & Antique Gold ---------- */
D({
  id: 't01',
  name: 'Kasu Mala Coin Necklace',
  zone: 'temple',
  type: 'necklace',
  cat: 'Long necklace',
  metals: ['ant', 'y22'],
  wt: 64,
  making: 0.16,
  sizes: 'chain',
  defaultSize: 24,
  stones: [{ role: 'main', kind: 'ruby', ct: 0.12, n: 25 }],
  stoneOptions: { main: ['ruby', 'emerald'] },
  build: {
    type: 'necklace',
    style: 'motifs',
    motif: 'coin',
    count: 23,
    motifMM: 18,
    span: 0.46,
    graduate: false,
    link: 2.4,
  },
  tags: ['Temple', 'Coin', 'Antique'],
  desc: 'Twenty-five temple coins with a flower boss and a ruby at the centre of each, strung close on an antique-finish chain.',
  tryon: 'neck',
});
D({
  id: 't02',
  name: 'Mayur Temple Choker',
  zone: 'temple',
  type: 'necklace',
  cat: 'Choker',
  metals: ['ant', 'y22'],
  wt: 48,
  making: 0.2,
  stones: [
    { role: 'main', kind: 'ruby', ct: 0.4, n: 9 },
    { role: 'accent', kind: 'emerald', ct: 0.05, n: 45 },
    { role: 'pearl', kind: 'pearl', n: 9 },
  ],
  stoneOptions: { main: ['ruby', 'emerald'], accent: ['emerald', 'ruby'] },
  build: {
    type: 'necklace',
    style: 'choker',
    lengthIn: 14,
    motif: 'mayur',
    count: 9,
    motifMM: 22,
    span: 0.36,
    accent: '@accent',
    drops: 'pearl',
    dropR: 1.9,
    back: 'chain',
  },
  tags: ['Temple', 'Peacock', 'Choker'],
  desc: 'Nine peacocks in antique gold, each with a ruby body and a fan of emeralds, ending in pearl drops.',
  tryon: 'neck',
});
D({
  id: 't03',
  name: 'Lakshmi Temple Jhumkas',
  zone: 'temple',
  type: 'earrings',
  cat: 'Jhumkas',
  metals: ['ant', 'y22'],
  wt: 16,
  making: 0.18,
  stones: [
    { role: 'main', kind: 'ruby', ct: 0.5, n: 2 },
    { role: 'pearl', kind: 'pearl', n: 30 },
  ],
  stoneOptions: { main: ['ruby', 'emerald'] },
  build: { type: 'earrings', style: 'jhumka', topMM: 13, topCut: 'cabochon', bellR: 9, bellH: 12, drops: 14, gap: 36 },
  tags: ['Jhumka', 'Temple', 'Pearls'],
  desc: 'Bell jhumkas with granulated bands and a pearl fringe, under a flower top with a ruby centre.',
  tryon: 'ear',
});
D({
  id: 't04',
  name: 'Kalyani Temple Kadas',
  zone: 'temple',
  type: 'bangle',
  cat: 'Kadas (pair)',
  metals: ['ant', 'y22'],
  wt: 70,
  making: 0.16,
  sizes: 'bangle',
  stones: [{ role: 'main', kind: 'ruby', ct: 0.2, n: 32 }],
  stoneOptions: { main: ['ruby', 'emerald'] },
  build: { type: 'bangle', style: 'temple-kada', count: 2, thick: 3.6, width: 8, stones: 16, ridges: 4, gapMM: 2 },
  tags: ['Kada', 'Temple', 'Pair'],
  desc: 'A pair of ribbed temple kadas with a row of rubies in rub-over collets and granulated edges.',
  tryon: 'wrist',
});
D({
  id: 't05',
  name: 'Aam Mala Mango Necklace',
  zone: 'temple',
  type: 'necklace',
  cat: 'Necklace',
  metals: ['ant', 'y22'],
  wt: 46,
  making: 0.18,
  sizes: 'chain',
  defaultSize: 20,
  stones: [
    { role: 'main', kind: 'ruby', ct: 0.35, n: 17 },
    { role: 'accent', kind: 'emerald', ct: 0.02, n: 120 },
  ],
  stoneOptions: { main: ['ruby', 'emerald'], accent: ['emerald', 'ruby'] },
  build: {
    type: 'necklace',
    style: 'motifs',
    motif: 'paisley',
    count: 17,
    motifMM: 16,
    span: 0.38,
    accent: '@accent',
    link: 2.2,
  },
  tags: ['Mango', 'Temple', 'Kairi'],
  desc: 'Mango (kairi) motifs, the classic South Indian manga mala: a ruby in every mango and a border of tiny emeralds.',
  tryon: 'neck',
});
D({
  id: 't06',
  name: 'Surya Temple Tikka',
  zone: 'temple',
  type: 'tikka',
  cat: 'Maang tikka',
  metals: ['ant', 'y22'],
  wt: 8,
  making: 0.18,
  stones: [
    { role: 'main', kind: 'ruby', ct: 0.3, n: 1 },
    { role: 'pearl', kind: 'pearl', n: 5 },
  ],
  stoneOptions: { main: ['ruby', 'emerald'] },
  build: { type: 'tikka', motif: 'coin', motifMM: 20, chainMM: 46, drops: 5 },
  tags: ['Maang tikka', 'Temple'],
  desc: 'A temple sun coin with a ruby boss and a pearl fringe.',
  tryon: 'forehead',
});

/* ---------- Everyday & Men's ---------- */
D({
  id: 'e01',
  name: 'Kanak Cable Chain',
  zone: 'everyday',
  type: 'necklace',
  cat: 'Chain',
  metals: ['y22', 'y18', 'r18', 'w18'],
  wt: 7.6,
  making: 0.09,
  sizes: 'chain',
  defaultSize: 18,
  build: { type: 'necklace', style: 'chain', link: 2.6 },
  tags: ['Chain', 'Everyday', 'Light'],
  desc: 'A classic cable chain, light enough for every day and strong enough for a pendant.',
  tryon: 'neck',
});
D({
  id: 'e02',
  name: 'Ananta Infinity Pendant',
  zone: 'everyday',
  type: 'pendant',
  cat: 'Pendant',
  metals: ['r18', 'y18', 'w18'],
  wt: 3.6,
  making: 0.16,
  quality: true,
  sizes: 'chain',
  defaultSize: 18,
  stones: [dia(0.01, 10)],
  build: { type: 'pendant', style: 'chain', pendant: 'infinity', pendantMM: 16, link: 1.5 },
  tags: ['Infinity', 'Gift', 'Everyday'],
  desc: 'A figure-of-eight with pavé diamonds along one loop, on a fine chain.',
  tryon: 'neck',
});
D({
  id: 'e03',
  name: 'Bindu Solitaire Studs',
  zone: 'everyday',
  type: 'earrings',
  cat: 'Studs',
  metals: ['y18', 'w18', 'r18', 'pt'],
  wt: 1.4,
  making: 0.16,
  quality: true,
  whiteClaws: true,
  stones: [dia(0.2, 2, 'main')],
  build: { type: 'earrings', style: 'stud', stoneMM: 3.8, prongs: 4, gap: 22 },
  tags: ['Studs', 'Solitaire', 'Everyday'],
  desc: 'Round brilliant studs in four-claw settings with screw backs. The first diamonds most of our customers buy.',
  tryon: 'ear',
});
D({
  id: 'e04',
  name: 'Bel Twist Bangles',
  zone: 'everyday',
  type: 'bangle',
  cat: 'Bangles (pair)',
  metals: ['y22', 'y18', 'r18'],
  wt: 24,
  making: 0.12,
  sizes: 'bangle',
  build: { type: 'bangle', style: 'twist', count: 2, thick: 2.4, width: 3.2, wires: 3, turns: 34, gapMM: 1 },
  tags: ['Twist', 'Pair', 'Everyday'],
  desc: 'Three gold wires twisted into a rope, a pair of bangles that catch the light as your wrist turns.',
  tryon: 'wrist',
});
D({
  id: 'e05',
  name: 'Roshni Pavé Hoops',
  zone: 'everyday',
  type: 'earrings',
  cat: 'Hoops',
  metals: ['y18', 'w18', 'r18'],
  wt: 3.0,
  making: 0.18,
  quality: true,
  stones: [dia(0.012, 36, 'main')],
  build: { type: 'earrings', style: 'hoop', size: 9, wire: 1.4, pave: true, gap: 30 },
  tags: ['Hoops', 'Pavé', 'Everyday'],
  desc: 'Small hoops with a row of pavé diamonds on the front, hinged so they close with a click.',
  tryon: 'ear',
});
D({
  id: 'e06',
  name: 'Dil Heart Pendant',
  zone: 'everyday',
  type: 'pendant',
  cat: 'Pendant',
  metals: ['r18', 'y18', 'w18'],
  wt: 2.9,
  making: 0.16,
  sizes: 'chain',
  defaultSize: 16,
  stones: [{ role: 'main', kind: 'pink', ct: 1.1, n: 1, cut: 'heart' }],
  stoneOptions: { main: ['pink', 'ruby', 'sapphire', 'diamond'] },
  build: { type: 'pendant', style: 'chain', pendant: 'heart', stoneMM: 7, link: 1.5 },
  tags: ['Heart', 'Gift', 'Gemstone'],
  desc: 'A heart-shaped pink sapphire in three claws on a fine chain. Also in ruby, blue sapphire or diamond.',
  tryon: 'neck',
});
D({
  id: 'e07',
  name: 'Veer Men’s Kada',
  zone: 'everyday',
  type: 'bangle',
  cat: 'Men’s kada',
  gender: 'men',
  metals: ['y22', 'ag', 'pt'],
  wt: 42,
  making: 0.1,
  sizes: 'bangle',
  defaultSize: '2.8',
  build: { type: 'bangle', style: 'mens', thick: 5, width: 7 },
  tags: ['Men', 'Kada'],
  desc: 'A heavy, faceted kada with six polished sides. Solid, not hollow.',
  tryon: 'wrist',
});
D({
  id: 'e08',
  name: 'Shaurya Curb Bracelet',
  zone: 'everyday',
  type: 'bracelet',
  cat: 'Men’s bracelet',
  gender: 'men',
  metals: ['y22', 'pt', 'ag'],
  wt: 28,
  making: 0.1,
  sizes: 'wrist',
  defaultSize: 'L',
  build: { type: 'bracelet', style: 'curb', link: 8 },
  tags: ['Men', 'Curb', 'Bracelet'],
  desc: 'Flat curb links with a box clasp and a safety catch.',
  tryon: 'wrist',
});
D({
  id: 'e09',
  name: 'Raja Signet Ring',
  zone: 'everyday',
  type: 'ring',
  cat: 'Men’s ring',
  gender: 'men',
  metals: ['y22', 'y18', 'pt', 'ag'],
  wt: 9.2,
  making: 0.12,
  sizes: 'ring',
  defaultSize: 20,
  stones: [{ role: 'main', kind: 'diamond', ct: 0.06, n: 1 }],
  build: { type: 'ring', head: 'signet', stoneMM: 2.6, band: 'D', thick: 2.4, width: 4.5, headT: 0.3, headW: 1.0 },
  tags: ['Men', 'Signet', 'Onyx'],
  desc: 'A signet ring with a black onyx face and a single diamond.',
  tryon: 'finger',
});
D({
  id: 'e10',
  name: 'Sherwani Rope Chain',
  zone: 'everyday',
  type: 'necklace',
  cat: 'Men’s chain',
  gender: 'men',
  metals: ['y22', 'pt', 'ag'],
  wt: 22,
  making: 0.1,
  sizes: 'chain',
  defaultSize: 22,
  build: { type: 'necklace', style: 'chain', chain: 'rope', link: 4.2 },
  tags: ['Men', 'Chain'],
  desc: 'A solid rope chain for men, heavy enough to wear on its own over a kurta.',
  tryon: 'neck',
});

/* ---------- Pearls & Gemstones ---------- */
D({
  id: 'g01',
  name: 'Ratna Ruby Cocktail Ring',
  zone: 'gems',
  type: 'ring',
  cat: 'Cocktail ring',
  metals: ['y18', 'w18', 'r18'],
  wt: 5.2,
  making: 0.18,
  whiteClaws: false,
  sizes: 'ring',
  stones: [{ role: 'main', kind: 'ruby', ct: 3.2, n: 1, cut: 'oval' }, dia(0.012, 54, 'accent')],
  stoneOptions: { main: ['ruby', 'emerald', 'sapphire', 'pink', 'yellow', 'amethyst'] },
  build: {
    type: 'ring',
    head: 'cocktail',
    cut: 'oval',
    stoneMM: 10,
    prongs: 4,
    haloMM: 1.2,
    band: 'D',
    thick: 1.8,
    width: 2.4,
  },
  tags: ['Ruby', 'Cocktail', 'Halo'],
  desc: 'A deep red oval ruby in a double halo of diamonds. Also made in emerald, blue sapphire, pink or yellow sapphire and amethyst.',
  tryon: 'finger',
});
D({
  id: 'g02',
  name: 'Panna Emerald Pendant',
  zone: 'gems',
  type: 'pendant',
  cat: 'Pendant',
  metals: ['y18', 'w18', 'r18'],
  wt: 4.0,
  making: 0.16,
  sizes: 'chain',
  defaultSize: 18,
  stones: [{ role: 'main', kind: 'emerald', ct: 1.6, n: 1, cut: 'pear' }, dia(0.012, 26)],
  stoneOptions: { main: ['emerald', 'ruby', 'sapphire'] },
  build: { type: 'pendant', style: 'chain', pendant: 'halo-drop', cut: 'pear', stoneMM: 8.5, link: 1.6 },
  tags: ['Emerald', 'Pear', 'Halo'],
  desc: 'A pear-shaped Zambian emerald in a diamond halo, on a fine cable chain.',
  tryon: 'neck',
});
D({
  id: 'g03',
  name: 'Neelam Sapphire Ring',
  zone: 'gems',
  type: 'ring',
  cat: 'Gemstone ring',
  metals: ['w18', 'pt', 'y18'],
  wt: 4.1,
  making: 0.18,
  whiteClaws: true,
  sizes: 'ring',
  stones: [{ role: 'main', kind: 'sapphire', ct: 1.8, n: 1, cut: 'cushion' }, dia(0.012, 30), dia(0.01, 16)],
  stoneOptions: { main: ['sapphire', 'emerald', 'ruby', 'pink'] },
  build: {
    type: 'ring',
    head: 'halo',
    cut: 'cushion',
    stoneMM: 7.2,
    prongs: 4,
    band: 'D',
    thick: 1.7,
    width: 2.1,
    pave: true,
  },
  tags: ['Sapphire', 'Halo', 'Cushion'],
  desc: 'A cushion-cut blue sapphire with a halo and pavé shoulders, the stone of Saturn in Indian astrology.',
  tryon: 'finger',
});
D({
  id: 'g04',
  name: 'Samudra Pearl Strand',
  zone: 'gems',
  type: 'necklace',
  cat: 'Pearl strand',
  metals: ['y18', 'w18'],
  wt: 1.8,
  making: 0.1,
  sizes: 'chain',
  defaultSize: 18,
  stones: [{ role: 'pearl', kind: 'southsea', n: 48 }],
  stoneOptions: { pearl: ['cream', 'white', 'gold', 'black', 'pink'] },
  pearlChoice: true,
  build: { type: 'necklace', style: 'strand', pearlR: 4.2, graduate: true },
  tags: ['Pearls', 'South Sea', 'Strand'],
  desc: 'A hand-knotted strand of South Sea pearls, graduated towards the front, with an 18K clasp.',
  tryon: 'neck',
});
D({
  id: 'g05',
  name: 'Navratna Ring',
  zone: 'gems',
  type: 'ring',
  cat: 'Navratna ring',
  metals: ['y22', 'y18'],
  wt: 6.8,
  making: 0.16,
  sizes: 'ring',
  stones: [
    { kind: 'ruby', ct: 0.6, n: 1 },
    { kind: 'diamond', ct: 0.06, n: 1 },
    { kind: 'pearl', n: 1 },
    { kind: 'coral', ct: 0.3, n: 1 },
    { kind: 'emerald', ct: 0.25, n: 1 },
    { kind: 'yellow', ct: 0.25, n: 1 },
    { kind: 'sapphire', ct: 0.25, n: 1 },
    { kind: 'hessonite', ct: 0.25, n: 1 },
    { kind: 'cat', ct: 0.25, n: 1 },
  ],
  build: { type: 'ring', head: 'navratna', stoneMM: 7, band: 'D', thick: 1.8, width: 2.6 },
  tags: ['Navratna', 'Nine gems', 'Astrology'],
  desc: 'The nine planetary gems, ruby at the centre, set in a gold flower in the traditional order.',
  tryon: 'finger',
});
D({
  id: 'g06',
  name: 'Gulabi Pearl Jhumkas',
  zone: 'gems',
  type: 'earrings',
  cat: 'Jhumkas',
  metals: ['y22', 'y18'],
  wt: 12,
  making: 0.18,
  stones: [
    { role: 'main', kind: 'ruby', ct: 0.4, n: 2 },
    { role: 'band', kind: 'ruby', ct: 0.02, n: 64 },
    { role: 'pearl', kind: 'pearl', n: 28 },
  ],
  stoneOptions: { main: ['ruby', 'emerald', 'pink'] },
  build: {
    type: 'earrings',
    style: 'jhumka',
    topMM: 11,
    topCut: 'cabochon',
    bellR: 8,
    bellH: 10,
    band: 'ruby',
    drops: 14,
    gap: 34,
  },
  tags: ['Jhumka', 'Pearls', 'Ruby'],
  desc: 'Lighter jhumkas with a band of tiny rubies and a pearl fringe. Easy to wear from day to evening.',
  tryon: 'ear',
});
D({
  id: 'g07',
  name: 'Rangoli Gem Tennis Bracelet',
  zone: 'gems',
  type: 'bracelet',
  cat: 'Bracelet',
  metals: ['y18', 'w18', 'r18'],
  wt: 10.5,
  making: 0.18,
  sizes: 'wrist',
  stones: [{ role: 'main', kind: 'sapphire', ct: 0.09, n: 52 }],
  stoneOptions: { main: ['sapphire', 'ruby', 'emerald', 'pink', 'yellow'] },
  build: { type: 'bracelet', style: 'tennis', stoneMM: 2.8 },
  tags: ['Gemstone', 'Tennis'],
  desc: 'A line bracelet of matched sapphires. Choose ruby, emerald, pink or yellow sapphire instead.',
  tryon: 'wrist',
});

NY.PRODUCTS = P;
NY.byId = {};
for (const p of P) NY.byId[p.id] = p;

/* =====================================================================
   OPTIONS AND PRICES
   ===================================================================== */
NY.TYPE_LABEL = {
  ring: 'Rings',
  earrings: 'Earrings',
  necklace: 'Necklaces',
  pendant: 'Pendants',
  bangle: 'Bangles',
  bracelet: 'Bracelets',
  tikka: 'Maang tikka',
  nath: 'Nath',
};
NY.TRYON_LABEL = {
  finger: 'on your hand',
  wrist: 'on your wrist',
  ear: 'on your ears',
  neck: 'on your neck',
  forehead: 'on your forehead',
  nose: 'on your nose',
};
/** Size options for a product: [{ id, n, mm }] */
NY.sizesOf = (p) => {
  switch (p.sizes) {
    case 'ring':
      return NY.RING_SIZES.map(([n, mm]) => ({ id: n, n: String(n), mm }));
    case 'bangle':
      return NY.BANGLE_SIZES.map(([n, mm]) => ({ id: n, n, mm }));
    case 'chain':
      return NY.CHAIN_LENGTHS.map((n) => ({ id: n, n: n + '″', mm: n * 25.4 }));
    case 'wrist':
      return NY.WRIST_SIZES.map(([n, mm]) => ({ id: n, n, mm }));
    default:
      return [];
  }
};
NY.defaultSize = (p) => {
  if (p.defaultSize != null) return p.defaultSize;
  if (p.sizes === 'ring') return p.gender === 'men' ? 20 : 12;
  if (p.sizes === 'bangle') return '2.4';
  if (p.sizes === 'chain') return 18;
  if (p.sizes === 'wrist') return 'M';
  return null;
};
const sizeRef = (p) => {
  // the size the catalogue weight is quoted for
  return NY.defaultSize(p);
};
/** Default choices for a product. */
NY.defaultCfg = (p) => {
  const cfg = { metal: p.metal, size: NY.defaultSize(p), quality: p.quality ? 'ghvs' : null, stones: {} };
  if (p.caratOptions) cfg.carat = p.carat || p.caratOptions[0];
  for (const s of p.stones) if (s.role && !(s.role in cfg.stones)) cfg.stones[s.role] = s.kind;
  if (p.stoneOptions)
    for (const r in p.stoneOptions)
      if (!p.stoneOptions[r].includes(cfg.stones[r])) cfg.stones[r] = p.stoneOptions[r][0];
  return cfg;
};
/** Weight of the metal in grams for a configuration (metal density and size scale the catalogue weight). */
NY.weightOf = (p, cfg) => {
  const ref = NY.METAL[p.metal],
    m = NY.METAL[cfg.metal] || ref;
  let w = p.wt * (m.density / ref.density);
  if (p.sizes) {
    const opts = NY.sizesOf(p);
    const a = opts.find((o) => o.id === sizeRef(p)),
      b = opts.find((o) => o.id === cfg.size);
    if (a && b) {
      // rings and bangles scale with circumference, chains and bracelets with length
      const k = b.mm / a.mm;
      w *= p.type === 'pendant' ? 0.55 + 0.45 * k : k;
    }
  }
  return Math.round(w * 100) / 100;
};
/** Kinds of stone for the 3D build: { main, accent, drop, side, band, pearl } */
NY.stonesFor = (p, cfg) => {
  const out = {};
  for (const s of p.stones) if (s.role) out[s.role] = s.kind;
  Object.assign(out, cfg.stones || {});
  if (out.pearl === 'southsea' || out.pearl === 'pearl') out.pearl = 'white';
  if (p.pearlChoice && cfg.stones && cfg.stones.pearl) out.pearl = cfg.stones.pearl;
  if (!out.pearl) out.pearl = 'white';
  return out;
};
/** Size inputs for the 3D builders. */
NY.buildCfg = (p, cfg) => {
  const out = {};
  const opt = NY.sizesOf(p).find((o) => o.id === cfg.size);
  if (p.sizes === 'ring') out.ringDia = opt ? opt.mm : 17.2;
  if (p.sizes === 'bangle') out.bangleDia = opt ? opt.mm : 57.2;
  if (p.sizes === 'chain') out.lengthIn = opt ? opt.id : 18;
  if (p.sizes === 'wrist') out.wristMM = opt ? opt.mm : 165;
  if (p.type === 'ring' && !out.ringDia) out.ringDia = 17.2;
  if (p.caratOptions && cfg.carat) {
    const cut = (p.build && p.build.cut) || 'round';
    // girdle width from carat weight (6.45 mm per cube root of a carat for rounds)
    const k =
      { round: 1, oval: 0.86, pear: 0.82, marquise: 0.72, cushion: 0.94, princess: 0.86, emerald: 0.84, heart: 0.96 }[
        cut
      ] || 1;
    out.stoneMM = 6.45 * Math.cbrt(cfg.carat) * k;
  }
  return out;
};
const stoneName = (kind) => (NY.STONE[kind] ? NY.STONE[kind].n : kind);
/**
 * Price breakdown for a configuration:
 * { weight, rate, metal, making, stones: [{ name, detail, value }], subtotal, gst, total, caratTotal }
 */
NY.priceOf = (p, cfg) => {
  cfg = cfg || NY.defaultCfg(p);
  const weight = NY.weightOf(p, cfg);
  const rate = NY.metalRate(cfg.metal);
  const metal = weight * rate;
  const making = metal * p.making;
  const qf = cfg.quality ? (NY.QUALITY.find((q) => q.id === cfg.quality) || NY.QUALITY[1]).f : 1;
  const stones = [];
  let caratTotal = 0;
  for (const s of p.stones) {
    let kind = s.role && cfg.stones && cfg.stones[s.role] ? cfg.stones[s.role] : s.kind;
    if (s.role === 'pearl' && p.pearlChoice) kind = 'southsea';
    const info = NY.STONE[kind] || NY.STONE[s.kind] || { n: kind, perCt: 0 };
    const ct = s.solitaire && cfg.carat ? cfg.carat : s.ct || 0;
    let value;
    if (info.perPiece) value = info.perPiece * s.n;
    else {
      const per = kind === 'diamond' && s.solitaire ? NY.solitairePerCt(ct) : info.perCt;
      value = per * ct * s.n * (kind === 'diamond' ? qf : 1);
    }
    if (kind === 'diamond') caratTotal += ct * s.n;
    stones.push({
      name: stoneName(kind),
      kind,
      detail: info.perPiece
        ? s.n + (s.n === 1 ? ' piece' : ' pieces')
        : (s.n > 1 ? s.n + ' × ' : '') + ct.toFixed(ct < 0.1 ? 3 : 2) + ' ct',
      value,
    });
  }
  const stoneValue = stones.reduce((a, s) => a + s.value, 0);
  const subtotal = metal + making + stoneValue;
  const gst = (subtotal * NY.RATES.gstPct) / 100;
  return {
    weight,
    rate,
    metal,
    making,
    stones,
    stoneValue,
    subtotal,
    gst,
    total: Math.round(subtotal + gst),
    caratTotal: Math.round(caratTotal * 100) / 100,
  };
};
/** Starting price shown in lists (default configuration). */
NY.fromPrice = (p) => NY.priceOf(p, NY.defaultCfg(p)).total;
for (const p of P) p.price = NY.fromPrice(p);
/** One-line summary of a configuration for the bag. */
NY.cfgSummary = (p, cfg) => {
  const parts = [NY.METAL[cfg.metal].short];
  if (cfg.carat) parts.push(cfg.carat + ' ct');
  if (cfg.quality) parts.push((NY.QUALITY.find((q) => q.id === cfg.quality) || {}).n);
  for (const r in p.stoneOptions || {})
    if (cfg.stones && cfg.stones[r])
      parts.push(stoneName(cfg.stones[r] === 'cream' ? 'pearl' : cfg.stones[r]).replace('Freshwater pearl', 'Pearl'));
  const so = NY.sizesOf(p).find((o) => o.id === cfg.size);
  if (so) parts.push((p.sizes === 'ring' ? 'Size ' : p.sizes === 'chain' ? '' : 'Size ') + so.n);
  return parts.filter(Boolean).join(' · ');
};

/* =====================================================================
   BRIDAL SETS (shown in the Bridal Lounge)
   ===================================================================== */
NY.SETS = [
  {
    id: 'rajwada',
    name: 'Rajwada Bridal Set',
    blurb: 'Rani haar, chandbalis, maang tikka and nath in polki and pearls.',
    pieces: ['p01', 'p03', 'p04', 'p06'],
  },
  {
    id: 'jadau',
    name: 'Lucknowi Jadau Set',
    blurb: 'Kundan choker, polki chandbalis and a pair of jadau bangles.',
    pieces: ['p02', 'p03', 'p05'],
  },
  {
    id: 'heera',
    name: 'Heera Diamond Bridal',
    blurb: 'Diamond flower necklace, pear drops, tennis bracelet and a halo ring.',
    pieces: ['d02', 'd03', 'd04', 's02'],
  },
  {
    id: 'temple',
    name: 'Temple Bride',
    blurb: 'Peacock choker, temple jhumkas, kadas and a sun tikka in antique gold.',
    pieces: ['t02', 't03', 't04', 't06'],
  },
];

/* =====================================================================
   MERCHANDISING: which piece sits where. Variants: [id, metal, stones]
   ===================================================================== */
NY.MERCH = {
  // the hero plinth in the rotunda and the four pillar cases around it
  hero: ['p01'],
  pillars: [['s02'], ['g01'], ['d01'], ['t03']],
  // two glass columns in the foyer
  columns: [['d07'], ['g02', 'y18', { main: 'emerald' }]],
  // per salon: three wall niches (necklaces on busts), left and right wall cases, and the counter tray
  // (counters are low glass cases: rings, earrings, tikkas, naths, bangles and bracelets only, no busts)
  salons: {
    everyday: {
      niches: [['e02'], ['e01'], ['e06']],
      left: [['e04'], ['e05'], ['e03'], ['e07']],
      right: [['e10'], ['e08'], ['e09'], ['e01', 'y18']],
      counter: [
        ['e03', 'w18'],
        ['e07', 'ag'],
        ['e05', 'r18'],
        ['e09', 'pt'],
        ['e08', 'pt'],
        ['e04', 'r18'],
      ],
    },
    temple: {
      niches: [['t02'], ['t01'], ['t05']],
      left: [['t03'], ['t06'], ['t04']],
      right: [
        ['t03', 'y22', { main: 'emerald' }],
        ['t04', 'y22', { main: 'emerald' }],
        ['t06', 'y22'],
      ],
      counter: [['t03', 'y22'], ['t06'], ['t04', 'ant', { main: 'emerald' }]],
    },
    polki: {
      niches: [['p02'], ['p01'], ['p02', 'y22', { accent: 'emerald' }]],
      left: [['p03'], ['p04'], ['p05']],
      right: [['p06'], ['p07'], ['p05', 'y22', { accent: 'emerald' }]],
      counter: [['p07', 'y22', { accent: 'emerald' }], ['p03'], ['p04', 'y22', { drop: 'emerald' }], ['p06']],
    },
    solitaire: {
      niches: [
        ['d07', 'w18'],
        ['d01', 'w18'],
        ['d07', 'r18'],
      ],
      left: [['s01'], ['s02'], ['s03'], ['s04']],
      right: [['s05'], ['s06'], ['s07'], ['s01', 'y18']],
      counter: [
        ['s01', 'pt'],
        ['s02', 'r18'],
        ['s03', 'y18'],
        ['s04', 'pt'],
        ['s05', 'y18'],
        ['s07', 'w18'],
      ],
    },
    diamond: {
      niches: [['d02'], ['d01'], ['d02', 'w18']],
      left: [['d03'], ['d06'], ['d04']],
      right: [['d05'], ['d03', 'y18'], ['d05', 'w18']],
      counter: [
        ['d06', 'y18'],
        ['d03', 'r18'],
        ['d04', 'y18'],
        ['d06', 'r18'],
      ],
    },
    gems: {
      niches: [['g04'], ['g02'], ['g04', 'y18', { pearl: 'gold' }]],
      left: [['g01'], ['g03'], ['g05'], ['g06']],
      right: [
        ['g07'],
        ['g01', 'w18', { main: 'emerald' }],
        ['g03', 'w18', { main: 'emerald' }],
        ['g07', 'y18', { main: 'ruby' }],
      ],
      counter: [
        ['g01', 'y18', { main: 'sapphire' }],
        ['g05'],
        ['g06', 'y22', { main: 'emerald' }],
        ['g03', 'pt', { main: 'pink' }],
      ],
    },
  },
  // the bridal lounge: three tall cases with full sets on busts, and the coffee table trays
  lounge: {
    cases: ['rajwada', 'heera', 'temple'],
    table: [['p03'], ['p04'], ['t03'], ['d03']],
  },
};
