// The shops in the Plexus marketplace. Read by the marketplace page (src/market), the shop build
// (scripts/build-shops.mjs), the dev server (vite.config.js) and the tests.
//
// To add a shop: copy its Vite project into shops/<folder>/ (it must read import.meta.env.BASE_URL for its own files),
// add an entry here and to SHOP_BUILDS, add its headers to vercel.json, and link back to "/" from the shop.

/** Shops built from their own project in shops/<folder>/ and served at /<path>/. */
export const SHOP_BUILDS = Object.freeze([
  Object.freeze({ folder: 'taana-clothing-showroom', path: 'clothing' }),
  Object.freeze({ folder: 'kanak-jewellery-showroom', path: 'jewellery' }),
  Object.freeze({ folder: 'brijman-opticals-salon', path: 'opticals' }),
]);

/**
 * Everything the marketplace page shows about each shop.
 * bagKey: the shop's saved bag in localStorage (same origin), so the marketplace can show how many items are waiting.
 */
export const SHOPS = Object.freeze([
  Object.freeze({
    id: 'eyewear',
    path: 'eyewear',
    name: 'Brijman Eyewear',
    category: 'Eyewear',
    tagline: 'Spectacles, sunglasses and contact lenses',
    blurb: 'Ten sections and 41 frame styles, each drawn from its real millimetre size. Book an eye test in the store.',
    tryOn: 'Frames on your face at their true size, with a fit guide',
    tryOnIcon: 'face',
    stats: ['10 sections', '41 styles'],
    bagKey: 'bm-bag-v2',
    theme: { a: '#1f6b57', b: '#cfe4dc', ink: '#0f2a22' },
  }),
  Object.freeze({
    id: 'opticals',
    path: 'opticals',
    name: 'Brijman Opticals Salon',
    category: 'Eyewear',
    tagline: 'A boutique optical salon with a lounge',
    blurb:
      'Marble islands, arched frame niches and a velvet lounge. Eight sections and 41 frame styles in three sizes, each drawn from its real millimetre size.',
    tryOn: 'Frames at their real size; measures your face and pupillary distance and suggests a size',
    tryOnIcon: 'face',
    stats: ['8 sections', '41 styles'],
    bagKey: 'brijman-bag-v1',
    theme: { a: '#1f2b45', b: '#ece4d6', ink: '#1a1a1f' },
  }),
  Object.freeze({
    id: 'clothing',
    path: 'clothing',
    name: 'Taana Studio',
    category: 'Clothing',
    tagline: 'Menswear, womenswear and occasion wear',
    blurb: 'Eleven sections and 36 styles. Every garment is a cloth simulation that drapes and moves as you walk by.',
    tryOn: 'The garment simulated over your body as you move',
    tryOnIcon: 'body',
    stats: ['11 sections', '36 styles'],
    bagKey: 'taana-bag-v1',
    theme: { a: '#2f3b6e', b: '#e8d9c4', ink: '#1e1b26' },
  }),
  Object.freeze({
    id: 'jewellery',
    path: 'jewellery',
    name: 'Kanak Fine Jewellery',
    category: 'Jewellery',
    tagline: 'Gold, diamond and polki, priced live',
    blurb:
      'A domed rotunda, six salons and a private bridal lounge. Every piece is built in 3D and priced from today’s gold rate.',
    tryOn: 'Earrings and necklaces on your face, rings and bangles on your hand',
    tryOnIcon: 'hand',
    stats: ['6 salons', 'Bridal lounge'],
    bagKey: 'kanak-bag-v1',
    theme: { a: '#8a6526', b: '#f2e3bd', ink: '#1d1813' },
  }),
]);

/** URL of a shop's front door. */
export const shopUrl = (shop) => '/' + shop.path + '/';

/**
 * Number of items in a shop's saved bag, or 0 if there is none or it cannot be read.
 * Each shop saves an array of lines; a line may carry a quantity.
 * @param {{getItem: (k: string) => string|null}} storage
 * @param {{bagKey: string}} shop
 */
export function bagCount(storage, shop) {
  try {
    const lines = JSON.parse(storage.getItem(shop.bagKey) || '[]');
    if (!Array.isArray(lines)) return 0;
    return lines.reduce((n, l) => n + (l && typeof l === 'object' ? Math.max(1, Math.min(99, +l.qty || 1)) : 0), 0);
  } catch (e) {
    return 0;
  }
}
