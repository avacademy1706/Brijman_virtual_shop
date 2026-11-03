// Sample catalogue, size charts, store merchandising and pricing (INR). Replace with the client's stock.
// Every garment is described by a cloth "template" (see src/cloth/garments.js) plus measurements in metres,
// a fabric preset, a print and colours. The same data drives the store displays, the mannequin viewer,
// the camera try-on and the build-time drape bake (scripts/bake-drapes.mjs).
import { NY } from '../core/ny.js';

/* ---------- Size charts: body chest girth in metres ---------- */
NY.SIZES = {
  women: [
    ['XS', 0.81],
    ['S', 0.86],
    ['M', 0.91],
    ['L', 0.97],
    ['XL', 1.02],
    ['XXL', 1.07],
  ],
  men: [
    ['S', 0.91],
    ['M', 0.97],
    ['L', 1.02],
    ['XL', 1.07],
    ['XXL', 1.12],
  ],
  kids: [
    ['4-5Y', 0.58],
    ['6-7Y', 0.62],
    ['8-9Y', 0.66],
    ['10-11Y', 0.7],
    ['12-13Y', 0.75],
  ],
};
/* Ease: garment chest minus body chest, by cut. */
NY.EASE = { fitted: 0.05, regular: 0.09, relaxed: 0.15, flowy: 0.11 };
NY.FIT_LABEL = { fitted: 'Fitted', regular: 'Regular fit', relaxed: 'Relaxed fit', flowy: 'Flowy' };

/* ---------- Fabrics shown in the UI (physics presets live in src/cloth/sim.js) ---------- */
NY.FABRIC_INFO = {
  cotton: { n: 'Cotton', care: 'Machine wash cold. Dry in shade.', feel: 'Breathable, holds a crisp shape' },
  linen: { n: 'Linen', care: 'Machine wash cold. Iron while damp.', feel: 'Cool and textured, softens with wear' },
  rayon: { n: 'Rayon', care: 'Gentle wash. Dry in shade. Warm iron.', feel: 'Soft, fluid drape' },
  silk: { n: 'Silk', care: 'Dry clean only.', feel: 'Smooth, with a soft sheen' },
  georgette: { n: 'Georgette', care: 'Dry clean recommended.', feel: 'Light and floaty, swings as you walk' },
  chiffon: { n: 'Chiffon', care: 'Hand wash cold or dry clean.', feel: 'Sheer and very light' },
  denim: { n: 'Denim', care: 'Wash inside out, cold.', feel: 'Sturdy twill, structured' },
};

/* ---------- Products ---------- */
const P = [];
/**
 * G(): a garment.
 * kind: 'women' | 'men' | 'kids' (size chart and mannequin), cat: browse category, len: length at the middle size (m)
 */
function G(id, name, zone, cat, kind, template, o) {
  const p = Object.assign(
    {
      id,
      name,
      zone,
      cat,
      kind,
      template,
      type: 'garment',
      fit: 'regular',
      fabric: 'cotton',
      pattern: 'solid',
      price: 1490,
      tags: [],
      over: null,
      hipF: 1.04,
    },
    o,
  );
  p.colors = p.colors.map((c) => Object.assign({}, c));
  P.push(p);
  return p;
}
/** D(): a dupatta or stole (free size). */
function D(id, name, o) {
  const p = Object.assign(
    {
      id,
      name,
      zone: 'dupatta',
      cat: 'dupatta',
      kind: 'free',
      template: 'dupatta',
      type: 'dupatta',
      fabric: 'chiffon',
      pattern: 'solid',
      dims: { length: 2.25, width: 0.9 },
      drape: 'stole',
      tags: [],
    },
    o,
  );
  P.push(p);
  return p;
}
const gold = { color: '#c9a24c', width: 0.05 };

/* Women · Ethnic */
G('k01', 'Gulmohar Straight Kurta', 'ethnic', 'kurta', 'women', 'kurta', {
  fabric: 'rayon',
  pattern: 'block',
  len: 1.05,
  price: 1890,
  colors: [
    { n: 'Rust', base: '#b5462f', accent: '#f1d7a6', border: '#3a2a20' },
    { n: 'Indigo', base: '#2c3a66', accent: '#e9dcc0', border: '#c9a24c' },
    { n: 'Sage', base: '#7f9479', accent: '#f4ecd8', border: '#3e4d3a' },
  ],
  border: { width: 0.05 },
  tags: ['Block print', 'Side slits', 'Three-quarter sleeves'],
  desc: 'A straight kurta in soft rayon with a hand-block floral print and a printed hem band. Side slits from the hip.',
});
G('k02', 'Neel Ikat Kurta', 'ethnic', 'kurta', 'women', 'kurta', {
  fabric: 'cotton',
  pattern: 'ikat',
  len: 1.0,
  price: 2190,
  over: { sleeve: 'long' },
  colors: [
    { n: 'Indigo', base: '#26335c', accent: '#d9e1ee' },
    { n: 'Charcoal', base: '#33363b', accent: '#e8c27a' },
  ],
  tags: ['Handloom ikat', 'Full sleeves'],
  desc: 'Handloom cotton ikat woven in Telangana. Full sleeves, a round neck and a short button placket.',
});
G('k03', 'Mehr Georgette Anarkali', 'ethnic', 'anarkali', 'women', 'anarkali', {
  fabric: 'georgette',
  pattern: 'dots',
  fit: 'flowy',
  len: 1.25,
  price: 4490,
  colors: [
    { n: 'Teal', base: '#1f4e5f', accent: '#d9b86a', border: '#d9b86a' },
    { n: 'Wine', base: '#5e1f33', accent: '#e9c98a', border: '#e9c98a' },
  ],
  border: { width: 0.06 },
  tags: ['Floor length', 'Flared', 'Zari hem'],
  desc: 'A floor-length anarkali in light georgette with a fitted bodice, a full flare from the waist and a zari hem.',
});
G('k04', 'Rangoli Silk Anarkali', 'ethnic', 'anarkali', 'women', 'anarkali', {
  fabric: 'silk',
  pattern: 'brocade',
  fit: 'flowy',
  len: 1.2,
  price: 5990,
  over: { folds: 10 },
  colors: [
    { n: 'Maroon', base: '#6d1a2a', accent: '#d8b45c', border: '#d8b45c' },
    { n: 'Emerald', base: '#0f4f3f', accent: '#e2c06a', border: '#e2c06a' },
  ],
  border: { width: 0.08 },
  tags: ['Festive', 'Silk', 'Woven motifs'],
  desc: 'Festive silk with woven gold buttis and a broad zari border. The bodice is lined; the skirt is cut on a full circle.',
});
G('k05', 'Kesar Linen Kurta', 'ethnic', 'kurta', 'women', 'kurta', {
  fabric: 'linen',
  pattern: 'stripe',
  len: 0.98,
  price: 2390,
  colors: [
    { n: 'Mustard', base: '#d7a33b', accent: '#fff3d6' },
    { n: 'Powder blue', base: '#9fb8d0', accent: '#ffffff' },
  ],
  tags: ['Linen', 'Pinstripe'],
  desc: 'Pure linen with a fine pinstripe. It starts crisp and softens with every wash.',
});
G('k06', 'Pallavi Short Kurti', 'ethnic', 'kurta', 'women', 'kurta', {
  fabric: 'cotton',
  pattern: 'check',
  len: 0.78,
  price: 1290,
  over: { slit: 0.18, sleeve: 'short' },
  colors: [
    { n: 'Rose', base: '#e6a1a4', accent: '#8a3a46' },
    { n: 'Lemon', base: '#ecd77a', accent: '#6e6a2c' },
  ],
  tags: ['Hip length', 'Short sleeves', 'Pairs with jeans'],
  desc: 'A hip-length cotton kurti in a small gingham check. Short sleeves and short side slits.',
});
G('k07', 'Ira Long Kurta', 'ethnic', 'kurta', 'women', 'kurta', {
  fabric: 'rayon',
  pattern: 'paisley',
  len: 1.18,
  price: 2790,
  over: { sleeve: 'long', slit: 0.45 },
  colors: [
    { n: 'Plum', base: '#4b2342', accent: '#e7b9cf', border: '#e7b9cf' },
    { n: 'Ochre', base: '#b9802f', accent: '#5b2d16', border: '#5b2d16' },
  ],
  border: { width: 0.04 },
  tags: ['Calf length', 'High slits', 'Paisley'],
  desc: 'A calf-length kurta with high side slits, full sleeves and an all-over paisley print.',
});
G('k08', 'Noor Flared Kurta', 'ethnic', 'anarkali', 'women', 'anarkali', {
  fabric: 'rayon',
  pattern: 'floral',
  fit: 'flowy',
  len: 1.02,
  price: 3290,
  over: { sleeve: 'three-quarter', folds: 8 },
  colors: [
    { n: 'Coral', base: '#e07a5f', accent: '#fff1e6' },
    { n: 'Powder pink', base: '#e9b8c0', accent: '#7b3949' },
  ],
  tags: ['Knee length', 'Flared'],
  desc: 'A knee-length flared kurta with three-quarter sleeves. Light enough to twirl.',
});

/* Women · Western */
G('w01', 'Monsoon Midi Dress', 'western', 'dress', 'women', 'dress', {
  fabric: 'rayon',
  pattern: 'dots',
  fit: 'flowy',
  len: 1.05,
  price: 2490,
  colors: [
    { n: 'Navy dot', base: '#1f2c4a', accent: '#f4efe3' },
    { n: 'Olive dot', base: '#55603a', accent: '#f4efe3' },
    { n: 'Red dot', base: '#a52a2a', accent: '#f6e9d8' },
  ],
  tags: ['Midi', 'Cap sleeves', 'Flared skirt'],
  desc: 'A midi dress with cap sleeves, a fitted waist and a flared skirt in fluid rayon.',
});
G('w02', 'Sunday Shirt Dress', 'western', 'dress', 'women', 'dress', {
  fabric: 'cotton',
  pattern: 'stripe',
  fit: 'regular',
  len: 1.0,
  price: 2690,
  over: {
    sleeve: 'short',
    buttons: 7,
    flareFrom: 0.75,
    folds: 0,
    hemF: 1.6,
    neck: { front: 0.07, back: 0.02, half: 0.065 },
  },
  colors: [
    { n: 'Blue stripe', base: '#dfe8f2', accent: '#3d5f8f' },
    { n: 'Sage stripe', base: '#e5ebe0', accent: '#5f7a55' },
  ],
  tags: ['Button front', 'Pockets'],
  desc: 'A cotton shirt dress with a full button front and a softly gathered skirt.',
});
G('w03', 'Marigold Maxi Dress', 'western', 'dress', 'women', 'dress', {
  fabric: 'georgette',
  pattern: 'floral',
  fit: 'flowy',
  len: 1.3,
  price: 3190,
  over: { sleeve: 'three-quarter', folds: 11 },
  colors: [
    { n: 'Marigold', base: '#e3a33a', accent: '#7a2e1d' },
    { n: 'Midnight', base: '#1c2238', accent: '#e2a3b7' },
  ],
  tags: ['Maxi', 'Georgette'],
  desc: 'A floor-length georgette maxi with three-quarter sleeves and a full skirt that moves with you.',
});
G('w04', 'Breeze Crew Tee', 'western', 'tee', 'women', 'tee', {
  fabric: 'cotton',
  pattern: 'solid',
  len: 0.62,
  price: 790,
  colors: [
    { n: 'White', base: '#f3f1ec' },
    { n: 'Black', base: '#22211f' },
    { n: 'Terracotta', base: '#c2694a' },
    { n: 'Sky', base: '#a9c7e3' },
  ],
  tags: ['Supima cotton', 'Crew neck'],
  desc: 'A soft crew-neck tee in long-staple cotton jersey.',
});
G('w05', 'Linen Day Shirt', 'western', 'shirt', 'women', 'shirt', {
  fabric: 'linen',
  pattern: 'stripe',
  fit: 'relaxed',
  len: 0.72,
  price: 1990,
  colors: [
    { n: 'White stripe', base: '#f1eee7', accent: '#9a7b5a' },
    { n: 'Sand', base: '#d8c3a0', accent: '#f3ead9' },
  ],
  tags: ['Linen', 'Relaxed'],
  desc: 'A relaxed linen shirt with dropped shoulders and a curved hem.',
});

/* Denim & Basics */
G('b01', 'Everyday Crew Tee', 'basics', 'tee', 'men', 'tee', {
  fabric: 'cotton',
  len: 0.7,
  price: 599,
  colors: [
    { n: 'White', base: '#f2f1ed' },
    { n: 'Black', base: '#1e1e1d' },
    { n: 'Navy', base: '#1f2a44' },
    { n: 'Olive', base: '#5a6142' },
    { n: 'Heather grey', base: '#a7a8a6' },
    { n: 'Brick', base: '#9c4430' },
  ],
  tags: ['Unisex', '180 gsm'],
  desc: 'A 180 gsm cotton tee with a ribbed crew neck. Unisex sizing.',
});
G('b02', 'Indigo Denim Shirt', 'basics', 'shirt', 'men', 'shirt', {
  fabric: 'denim',
  pattern: 'denim',
  len: 0.76,
  price: 2290,
  colors: [
    { n: 'Indigo', base: '#2d4369', trim: '#c9b48a' },
    { n: 'Light wash', base: '#7f9bbd', trim: '#e6e1d4' },
  ],
  tags: ['Denim', 'Button down'],
  desc: 'A 6 oz denim shirt with copper-tone buttons. It fades in its own way over time.',
});
G('b03', 'Pocket Tee', 'basics', 'tee', 'men', 'tee', {
  fabric: 'cotton',
  pattern: 'stripe',
  len: 0.72,
  price: 699,
  colors: [
    { n: 'Breton navy', base: '#f3f0e8', accent: '#1f2a44' },
    { n: 'Breton red', base: '#f3f0e8', accent: '#a7312b' },
  ],
  tags: ['Striped', 'Chest pocket'],
  desc: 'A striped tee in heavy cotton jersey.',
});
G('b04', 'Chambray Shirt', 'basics', 'shirt', 'women', 'shirt', {
  fabric: 'cotton',
  pattern: 'denim',
  fit: 'relaxed',
  len: 0.7,
  price: 1890,
  colors: [{ n: 'Chambray', base: '#93a9c6' }],
  tags: ['Lightweight', 'Relaxed'],
  desc: 'A lightweight chambray shirt with a soft, relaxed body.',
});

/* Men's wear */
G('m01', 'Oxford Shirt', 'mens', 'shirt', 'men', 'shirt', {
  fabric: 'cotton',
  pattern: 'solid',
  fit: 'regular',
  len: 0.78,
  price: 1790,
  colors: [
    { n: 'White', base: '#f4f3ef' },
    { n: 'Oxford blue', base: '#a9c0dc' },
    { n: 'Pink', base: '#efc9cb' },
  ],
  tags: ['Oxford weave', 'Button down'],
  desc: 'A classic oxford-weave shirt with a button-down collar and a curved hem.',
});
G('m02', 'Madras Check Shirt', 'mens', 'shirt', 'men', 'shirt', {
  fabric: 'cotton',
  pattern: 'check',
  len: 0.76,
  price: 1690,
  over: { sleeve: 'short' },
  colors: [
    { n: 'Red madras', base: '#d9c7a6', accent: '#a2342b' },
    { n: 'Green madras', base: '#d4d1b2', accent: '#2f5d3f' },
  ],
  tags: ['Short sleeves', 'Madras'],
  desc: 'A short-sleeved shirt in lightweight madras check.',
});
G('m03', 'Khadi Kurta', 'mens', 'kurta', 'men', 'kurta', {
  fabric: 'cotton',
  pattern: 'solid',
  len: 1.0,
  price: 2190,
  over: { sleeve: 'long', slit: 0.3, neck: { front: 0.06, back: 0.02, half: 0.06 } },
  colors: [
    { n: 'Ivory', base: '#efe6d3' },
    { n: 'Sky', base: '#b9cfe3' },
    { n: 'Charcoal', base: '#3a3c40' },
  ],
  tags: ['Handspun khadi', 'Full sleeves'],
  desc: 'Handspun, handwoven khadi with a short placket and full sleeves. Cool in summer.',
});
G('m04', 'Linen Short Kurta', 'mens', 'kurta', 'men', 'kurta', {
  fabric: 'linen',
  pattern: 'stripe',
  len: 0.82,
  price: 1990,
  over: { sleeve: 'long', slit: 0.2 },
  colors: [
    { n: 'Sand stripe', base: '#d7c4a2', accent: '#7c6a4d' },
    { n: 'Navy stripe', base: '#2a3655', accent: '#9fb0cc' },
  ],
  tags: ['Hip length', 'Linen'],
  desc: 'A hip-length linen kurta that works with jeans as well as pyjamas.',
});
G('m05', 'Nehru Jacket', 'mens', 'jacket', 'men', 'vest', {
  fabric: 'linen',
  pattern: 'ikat',
  layer: 1,
  len: 0.68,
  price: 2990,
  colors: [
    { n: 'Indigo ikat', base: '#2d3a4a', accent: '#a7b6c2', trim: '#d8c9a8' },
    { n: 'Rust ikat', base: '#7a3424', accent: '#e9c49a', trim: '#e9c49a' },
  ],
  tags: ['Layering', 'Mandarin collar'],
  desc: 'A sleeveless Nehru jacket in handloom ikat with a mandarin collar and five buttons.',
});
G('m06', 'Bandi Festive Jacket', 'mens', 'jacket', 'men', 'vest', {
  fabric: 'silk',
  pattern: 'brocade',
  layer: 1,
  len: 0.68,
  price: 3990,
  colors: [
    { n: 'Midnight gold', base: '#1b2238', accent: '#cfae62', trim: '#cfae62' },
    { n: 'Wine gold', base: '#561a2a', accent: '#d9b86a', trim: '#d9b86a' },
  ],
  tags: ['Festive', 'Brocade'],
  desc: 'A festive bandi in silk brocade. Layer it over a kurta for weddings and pujas.',
});

/* Kids */
G('c01', 'Chhota Kurta', 'kids', 'kurta', 'kids', 'kurta', {
  fabric: 'cotton',
  pattern: 'block',
  len: 0.62,
  price: 890,
  over: { sleeve: 'long', slit: 0.12 },
  colors: [
    { n: 'Mango', base: '#f0b13c', accent: '#8a3b12' },
    { n: 'Leaf', base: '#7fae6a', accent: '#f3ecd2' },
  ],
  tags: ['Ages 4 to 13', 'Soft cotton'],
  desc: 'A little block-printed kurta in soft cotton with full sleeves.',
});
G('c02', 'Titli Dress', 'kids', 'dress', 'kids', 'dress', {
  fabric: 'cotton',
  pattern: 'dots',
  fit: 'flowy',
  len: 0.68,
  price: 990,
  colors: [
    { n: 'Bubblegum', base: '#f2a7c3', accent: '#ffffff' },
    { n: 'Lilac', base: '#b9a7e0', accent: '#ffffff' },
  ],
  tags: ['Twirly', 'Cotton'],
  desc: 'A twirly cotton dress with cap sleeves and a polka dot print.',
});
G('c03', 'Doodle Tee', 'kids', 'tee', 'kids', 'tee', {
  fabric: 'cotton',
  pattern: 'stripe',
  len: 0.48,
  price: 449,
  colors: [
    { n: 'Sunshine', base: '#f6d45a', accent: '#3a6fb0' },
    { n: 'Ocean', base: '#7cc3e0', accent: '#f6f3ea' },
  ],
  tags: ['Striped', 'Easy wash'],
  desc: 'A striped cotton tee that survives the playground.',
});
G('c04', 'Lehar Kids Anarkali', 'kids', 'anarkali', 'kids', 'anarkali', {
  fabric: 'georgette',
  pattern: 'dots',
  fit: 'flowy',
  len: 0.82,
  price: 1490,
  colors: [{ n: 'Peacock', base: '#1d6a7a', accent: '#f3d27a', border: '#f3d27a' }],
  border: { width: 0.04 },
  tags: ['Festive', 'Ages 4 to 13'],
  desc: 'A festive anarkali for kids with a gold dot print and a zari hem.',
});

/* Chikankari studio */
G('h01', 'Lucknow Classic Chikankari Kurta', 'chikan', 'kurta', 'women', 'kurta', {
  fabric: 'georgette',
  pattern: 'chikan',
  len: 1.08,
  price: 6490,
  colors: [
    { n: 'White on white', base: '#f4f1ea', accent: '#ffffff' },
    { n: 'Mint', base: '#cfe3d4', accent: '#f8fffa' },
  ],
  tags: ['Hand embroidered', 'Lucknow', 'Georgette'],
  desc: 'Hand-embroidered chikankari on georgette: shadow work, phanda knots and jaali. Worn over a matching slip.',
});
G('h02', 'Gulabi Chikankari Anarkali', 'chikan', 'anarkali', 'women', 'anarkali', {
  fabric: 'georgette',
  pattern: 'chikan',
  fit: 'flowy',
  len: 1.24,
  price: 8990,
  colors: [
    { n: 'Rose', base: '#ecc3c6', accent: '#fff6f6' },
    { n: 'Ivory', base: '#f3ece0', accent: '#ffffff' },
  ],
  tags: ['Hand embroidered', 'Floor length'],
  desc: 'A floor-length chikankari anarkali with twelve panels and hand-embroidered jaali all round the flare.',
});
G('h03', 'Nawab Chikankari Kurta', 'chikan', 'kurta', 'men', 'kurta', {
  fabric: 'cotton',
  pattern: 'chikan',
  len: 1.0,
  price: 5490,
  over: { sleeve: 'long', slit: 0.3, neck: { front: 0.06, back: 0.02, half: 0.06 } },
  colors: [
    { n: 'White', base: '#f5f3ee', accent: '#ffffff' },
    { n: 'Sky', base: '#c9daea', accent: '#f6fbff' },
  ],
  tags: ['Hand embroidered', 'Men'],
  desc: 'A men’s kurta in fine cotton with chikankari down the placket and across the yoke.',
});
G('h04', 'Pastel Chikankari Kurta', 'chikan', 'kurta', 'women', 'kurta', {
  fabric: 'cotton',
  pattern: 'chikan',
  len: 1.0,
  price: 5990,
  over: { sleeve: 'three-quarter' },
  colors: [
    { n: 'Lavender', base: '#d8cde8', accent: '#fbf8ff' },
    { n: 'Butter', base: '#f1e4b5', accent: '#fffdf2' },
  ],
  tags: ['Hand embroidered', 'Cotton'],
  desc: 'Chikankari on breathable cotton, finished with tiny scalloped edges at the sleeves.',
});

/* Dupatta & stole bar */
D('d01', 'Banarasi Silk Dupatta', {
  fabric: 'silk',
  pattern: 'brocade',
  price: 2490,
  drape: 'shoulder',
  colors: [
    { n: 'Rani pink', base: '#b8235a', accent: '#e2c06a', border: '#e2c06a' },
    { n: 'Royal blue', base: '#24418a', accent: '#e2c06a', border: '#e2c06a' },
  ],
  border: { width: 0.07 },
  tags: ['Banarasi', 'Zari border'],
  desc: 'Banarasi silk woven with gold buttis and a broad zari border. 2.25 m by 0.9 m.',
});
D('d02', 'Phulkari Dupatta', {
  fabric: 'cotton',
  pattern: 'phulkari',
  price: 1990,
  colors: [
    { n: 'Mustard', base: '#d39b2a', accent: '#b0263a', border: '#7a1626' },
    { n: 'Magenta', base: '#9e1d55', accent: '#f0b43c', border: '#f0b43c' },
  ],
  border: { width: 0.05 },
  tags: ['Embroidered', 'Punjab'],
  desc: 'Bright phulkari-style embroidery in silk thread on soft cotton.',
});
D('d03', 'Mulmul Cotton Dupatta', {
  fabric: 'cotton',
  pattern: 'solid',
  price: 890,
  colors: [
    { n: 'Off-white', base: '#f2ede2', border: '#c9a24c' },
    { n: 'Pista', base: '#c8d9a6', border: '#7a8c4a' },
    { n: 'Peach', base: '#f1c3a5', border: '#b06a42' },
  ],
  border: { width: 0.035 },
  tags: ['Everyday', 'Mulmul'],
  desc: 'Feather-light mulmul cotton with a thin woven border.',
});
D('d04', 'Ikat Silk Stole', {
  fabric: 'silk',
  pattern: 'ikat',
  price: 1490,
  dims: { length: 2.0, width: 0.7 },
  colors: [
    { n: 'Rust', base: '#c4533a', accent: '#f0c987' },
    { n: 'Teal', base: '#1f5f63', accent: '#e9d9b4' },
  ],
  tags: ['Unisex', 'Stole'],
  desc: 'A narrow ikat silk stole. Wear it over a kurta or a jacket.',
});
D('d05', 'Chiffon Lace Dupatta', {
  fabric: 'chiffon',
  pattern: 'solid',
  price: 1190,
  colors: [
    { n: 'Blush', base: '#e9a6a1', border: '#c9a24c' },
    { n: 'Lilac', base: '#c4b2df', border: '#c9a24c' },
  ],
  border: { width: 0.045 },
  tags: ['Sheer', 'Gota border'],
  desc: 'Sheer chiffon with a gota lace border on all four sides.',
});

NY.PRODUCTS = P;
NY.byId = {};
for (const p of P) NY.byId[p.id] = p;

/* ---------- Styling bases: plain pieces the viewer shows under jackets and dupattas ---------- */
NY.BASES = {
  women: {
    id: 'base-w',
    template: 'kurta',
    kind: 'women',
    fabric: 'cotton',
    pattern: 'solid',
    fit: 'regular',
    len: 1.02,
    colors: [{ n: 'Ivory', base: '#efe7d8' }],
  },
  men: {
    id: 'base-m',
    template: 'kurta',
    kind: 'men',
    fabric: 'cotton',
    pattern: 'solid',
    fit: 'regular',
    len: 1.0,
    over: { sleeve: 'long', slit: 0.3, neck: { front: 0.06, back: 0.02, half: 0.06 } },
    colors: [{ n: 'Ivory', base: '#efe7d8' }],
  },
};

/* ---------- Helpers ---------- */
NY.CAT_LABEL = {
  kurta: 'Kurtas',
  anarkali: 'Anarkalis',
  dress: 'Dresses',
  tee: 'Tees',
  shirt: 'Shirts',
  jacket: 'Jackets',
  dupatta: 'Dupattas & stoles',
};
NY.colorOf = (p, ci) => p.colors[(((ci || 0) % p.colors.length) + p.colors.length) % p.colors.length];
NY.sizesOf = (p) => (p.type === 'dupatta' ? [['Free size', 0]] : NY.SIZES[p.kind]);
/** Garment chest girth (m) for a size index. */
NY.garmentChest = (p, si) => NY.SIZES[p.kind][si][1] + NY.EASE[p.fit || 'regular'];
/** Middle size index (the size the length is quoted at). */
NY.midSize = (p) => (p.kind === 'men' ? 1 : p.kind === 'kids' ? 2 : 2);
/** Cloth spec for buildGarment(): template, measurements, fabric and look for one size and colour. */
NY.specFor = (p, si, ci) => {
  const col = NY.colorOf(p, ci);
  const look = { fabric: p.fabric, pattern: p.pattern, base: col.base, accent: col.accent, trim: col.trim };
  if (col.border || (p.border && p.border.color))
    look.border = { color: col.border || p.border.color, width: (p.border && p.border.width) || 0.05 };
  if (p.type === 'dupatta') {
    return Object.assign(
      { template: 'dupatta', drape: p.drape || 'stole', layer: 1, dims: Object.assign({}, p.dims) },
      look,
    );
  }
  const sizes = NY.SIZES[p.kind];
  si = Math.max(0, Math.min(sizes.length - 1, si == null ? NY.midSize(p) : si));
  const step = p.kind === 'kids' ? 0.045 : 0.015;
  const chest = NY.garmentChest(p, si);
  const dims = { chest, hip: chest * (p.hipF || 1.04), length: p.len + (si - NY.midSize(p)) * step };
  return Object.assign(
    { template: p.template, layer: p.layer || 0, over: p.over || null, dims, seed: p.id.charCodeAt(1) },
    look,
  );
};
/** Ellipse perimeter (Ramanujan), used for body girths. */
NY.girth = (a, b) => Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));
/** Fit words from ease (garment chest minus body chest, metres). */
NY.fitWord = (ease) =>
  ease < 0.01 ? 'Too tight' : ease < 0.045 ? 'Snug' : ease < 0.12 ? 'Regular' : ease < 0.2 ? 'Relaxed' : 'Oversized';
/** Smallest size that gives at least the intended ease minus 2 cm on a body with this chest girth. */
NY.recommendSize = (p, bodyChest) => {
  if (p.type === 'dupatta') return 0;
  const sizes = NY.SIZES[p.kind];
  const want = NY.EASE[p.fit || 'regular'] - 0.02;
  for (let i = 0; i < sizes.length; i++) if (NY.garmentChest(p, i) - bodyChest >= want) return i;
  return sizes.length - 1;
};
NY.defaultCfg = (p) => ({ size: p.type === 'dupatta' ? 0 : NY.midSize(p), alter: false });
NY.ALTER_PRICE = 0;
NY.priceOf = (p) => p.price;
NY.cfgSummary = (p, cfg) => {
  const parts = [];
  if (p.type !== 'dupatta') parts.push('Size ' + NY.SIZES[p.kind][cfg.size][0]);
  else parts.push('Free size');
  if (cfg.alter) parts.push('Alteration requested');
  return parts.join(' · ');
};

/* ---------- Store merchandising ---------- */
// Wall bays: one face-out piece, a side-hung rail and a shelf of folded stacks (product id, colour index).
NY.MERCH = {
  ethnic: [
    {
      face: ['k01', 0],
      rail: [
        ['k01', 1],
        ['k01', 2],
        ['k05', 0],
        ['k05', 1],
        ['k06', 0],
        ['k06', 1],
      ],
      shelf: ['k01', 'k05', 'k06'],
    },
    {
      face: ['k03', 0],
      rail: [
        ['k03', 1],
        ['k04', 0],
        ['k04', 1],
        ['k08', 0],
        ['k08', 1],
      ],
      shelf: ['k03', 'k08'],
    },
    {
      face: ['k07', 0],
      rail: [
        ['k07', 1],
        ['k02', 0],
        ['k02', 1],
        ['k02', 0],
        ['k07', 0],
      ],
      shelf: ['k02', 'k07'],
    },
  ],
  mens: [
    {
      face: ['m01', 0],
      rail: [
        ['m01', 1],
        ['m01', 2],
        ['m02', 0],
        ['m02', 1],
        ['m01', 0],
        ['m02', 0],
      ],
      shelf: ['m01', 'm02'],
    },
    {
      face: ['m03', 0],
      rail: [
        ['m03', 1],
        ['m03', 2],
        ['m04', 0],
        ['m04', 1],
        ['m03', 0],
      ],
      shelf: ['m03', 'm04'],
    },
    {
      face: ['m05', 0],
      rail: [
        ['m05', 1],
        ['m06', 0],
        ['m06', 1],
        ['m05', 0],
        ['m06', 0],
      ],
      shelf: ['m05', 'm06'],
    },
  ],
  kids: {
    face: ['c02', 0],
    rail: [
      ['c01', 0],
      ['c01', 1],
      ['c02', 1],
      ['c04', 0],
      ['c03', 0],
      ['c03', 1],
    ],
  },
  western: {
    face: [
      ['w03', 0],
      ['w02', 0],
    ],
    rail: [
      ['w01', 0],
      ['w01', 1],
      ['w01', 2],
      ['w03', 1],
      ['w02', 1],
      ['w05', 0],
      ['w05', 1],
    ],
  },
  westernTable: [
    ['w04', 0],
    ['w04', 1],
    ['w04', 2],
    ['w04', 3],
  ],
  westernForm: ['w01', 2],
  basics: [
    ['b01', 0],
    ['b01', 1],
    ['b01', 2],
    ['b01', 3],
    ['b01', 4],
    ['b01', 5],
    ['b03', 0],
    ['b03', 1],
    ['b02', 0],
    ['b02', 1],
    ['b04', 0],
    ['b01', 0],
  ],
  basicsForm: ['b02', 0],
  chikanForms: [
    ['h02', 0],
    ['h01', 0],
    ['h03', 0],
    ['h04', 0],
  ],
  chikanShelf: [
    ['h01', 1],
    ['h02', 1],
    ['h03', 1],
    ['h04', 1],
    ['h04', 0],
    ['h01', 0],
  ],
  dupattaTable: [
    ['d01', 0],
    ['d01', 1],
    ['d02', 0],
    ['d02', 1],
    ['d03', 0],
    ['d03', 1],
    ['d03', 2],
    ['d04', 0],
    ['d04', 1],
    ['d05', 0],
    ['d05', 1],
  ],
  dupattaForm: { base: ['k01', 1], top: ['d01', 0] },
  basicsTable: null,
  // Live looks: the podium (three mannequins) and the fitting room mannequin
  festive: [
    {
      kind: 'women',
      pieces: [
        ['k04', 0],
        ['d05', 0],
      ],
      drape: 'stole',
    },
    {
      kind: 'men',
      pieces: [
        ['m03', 0],
        ['m05', 0],
      ],
    },
    { kind: 'women', pieces: [['w03', 0]] },
  ],
  fitting: { kind: 'women', pieces: [['k03', 0]] },
};
