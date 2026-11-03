// Icons and the three shop illustrations for the marketplace page. Original artwork, drawn in SVG; colours come from
// each card's --a (accent), --b (background) and --k (ink) custom properties so they follow light and dark mode.

const svg = (body) =>
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
  body +
  '</svg>';

export const ICONS = {
  face: svg(
    '<circle cx="12" cy="12" r="8.5"/><path d="M8.5 14.5c1 1.3 2.2 2 3.5 2s2.5-.7 3.5-2"/><path d="M9 9.8h.01M15 9.8h.01"/>',
  ),
  body: svg('<circle cx="12" cy="5" r="2.2"/><path d="M8 21l1-7-2.5-1.5L8 8h8l1.5 4.5L15 14l1 7"/><path d="M12 8v6"/>'),
  hand: svg(
    '<path d="M8 12V5.5a1.5 1.5 0 0 1 3 0V11"/><path d="M11 10V4.5a1.5 1.5 0 0 1 3 0V11"/><path d="M14 10.5V6a1.5 1.5 0 0 1 3 0v7c0 4-2.5 7-6 7-2.6 0-4-1.3-5.4-3.4L3.6 13a1.5 1.5 0 0 1 2.5-1.6L8 14"/>',
  ),
  bag: svg('<path d="M5 8h14l-1 12H6z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/>'),
  arrow: svg('<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>'),
  close: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
  store: svg(
    '<path d="M4 9.5 5.5 4h13L20 9.5"/><path d="M4 9.5h16v.5a3 3 0 0 1-5.3 1.9A3 3 0 0 1 12 13a3 3 0 0 1-2.7-1.1A3 3 0 0 1 4 10z"/><path d="M5.5 12.5V20h13v-7.5"/><path d="M10 20v-4h4v4"/>',
  ),
  walk: svg(
    '<path d="M12 21c4-4 6.5-7.2 6.5-10.3a6.5 6.5 0 1 0-13 0C5.5 13.8 8 17 12 21z"/><circle cx="12" cy="10.5" r="2.2"/>',
  ),
  camera: svg(
    '<path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1.5-2h6l1.5 2h2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z"/><circle cx="12" cy="13" r="3.5"/>',
  ),
  shield: svg('<path d="M12 3.5 19 6v5.5c0 4.4-3 7.7-7 9-4-1.3-7-4.6-7-9V6z"/><path d="m9 12 2.2 2.2L15.5 10"/>'),
};

const art = (body) =>
  '<svg viewBox="0 0 320 200" preserveAspectRatio="xMidYMid slice" role="presentation">' + body + '</svg>';

export const ART = {
  // A pair of spectacles on a shelf, with lens reflections.
  eyewear: art(
    '<rect width="320" height="200" fill="var(--b)"/>' +
      '<circle cx="262" cy="34" r="70" fill="var(--a)" opacity=".12"/>' +
      '<rect x="0" y="150" width="320" height="50" fill="var(--a)" opacity=".14"/>' +
      '<rect x="0" y="146" width="320" height="6" fill="var(--a)" opacity=".35"/>' +
      '<g fill="none" stroke="var(--k)" stroke-width="7" stroke-linejoin="round">' +
      '<rect x="66" y="78" width="78" height="56" rx="20"/><rect x="176" y="78" width="78" height="56" rx="20"/>' +
      '<path d="M144 96c6-8 26-8 32 0"/><path d="M66 90 40 82M254 90l26-8" stroke-linecap="round"/></g>' +
      '<g fill="var(--a)" opacity=".22"><rect x="70" y="82" width="70" height="48" rx="16"/><rect x="180" y="82" width="70" height="48" rx="16"/></g>' +
      '<g stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".75"><path d="M84 96l14-10M194 96l14-10"/></g>',
  ),
  // A kurta on a hanger, its hem caught mid-swing.
  clothing: art(
    '<rect width="320" height="200" fill="var(--b)"/>' +
      '<circle cx="60" cy="40" r="76" fill="var(--a)" opacity=".1"/>' +
      '<path d="M0 170h320v30H0z" fill="var(--a)" opacity=".12"/>' +
      '<path d="M160 22a9 9 0 1 1 9 9c-5 0-9 3-9 8v5" fill="none" stroke="var(--k)" stroke-width="5" stroke-linecap="round"/>' +
      '<path d="M96 66l64-22 64 22" fill="none" stroke="var(--k)" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<path d="M128 56l-36 22 12 26 18-10-4 82c22 8 62 8 84 0l-4-82 18 10 12-26-36-22c-6 10-18 16-32 16s-26-6-32-16z" fill="var(--a)"/>' +
      '<path d="M122 186c22 6 50 6 76 0" fill="none" stroke="var(--b)" stroke-width="3" opacity=".6"/>' +
      '<path d="M160 72v52" stroke="var(--b)" stroke-width="3" stroke-dasharray="2 7" stroke-linecap="round" opacity=".8"/>' +
      '<path d="M134 120c10 30 8 50 2 66M186 120c-8 26-6 48 0 66" fill="none" stroke="var(--k)" stroke-width="2.5" opacity=".25"/>',
  ),
  // A necklace with a drop pendant, and a solitaire.
  jewellery: art(
    '<rect width="320" height="200" fill="var(--b)"/>' +
      '<circle cx="250" cy="150" r="90" fill="var(--a)" opacity=".1"/>' +
      '<path d="M78 34c10 70 44 104 82 104s72-34 82-104" fill="none" stroke="var(--a)" stroke-width="5"/>' +
      '<g fill="var(--a)">' +
      [0.12, 0.24, 0.36, 0.48, 0.6, 0.72, 0.84]
        .map((t) => {
          // points along the chain (quadratic-ish curve)
          const x = 78 + 164 * t;
          const y = 34 + 104 * (1 - Math.pow(2 * t - 1, 2)) * 0.98;
          return '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="5"/>';
        })
        .join('') +
      '</g>' +
      '<path d="M160 138l14 16-14 26-14-26z" fill="var(--a)" stroke="var(--k)" stroke-width="3" stroke-linejoin="round"/>' +
      '<path d="M146 154h28M160 138v42" stroke="var(--b)" stroke-width="2" opacity=".7"/>' +
      '<g transform="translate(254 52)"><path d="M-16 0l8-10h16l8 10-16 20z" fill="#fff" stroke="var(--k)" stroke-width="3" stroke-linejoin="round"/><path d="M-16 0h32M-8-10l8 30 8-30" fill="none" stroke="var(--k)" stroke-width="1.6" opacity=".6"/></g>' +
      '<g stroke="var(--a)" stroke-width="3" stroke-linecap="round"><path d="M282 34l6-6M290 46h8M226 30l-6-6"/></g>',
  ),
};
