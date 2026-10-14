// Checks that every 3D model and texture listed in assets-3d/catalogue.json is present, and that nothing is unlisted.
// Run with: npm run assets:check
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../assets-3d/', import.meta.url));
const catalogue = JSON.parse(readFileSync(join(root, 'catalogue.json'), 'utf8'));
const listed = [...catalogue.models, ...catalogue.textures].map((item) => item.file);

const onDisk = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full);
    else if (/\.(glb|png)$/i.test(name)) onDisk.push(relative(root, full).split(sep).join('/'));
  }
};
walk(root);

const missing = listed.filter((file) => !existsSync(join(root, file)));
const unlisted = onDisk.filter((file) => !listed.includes(file));
const count = (type) => catalogue.models.filter((m) => m.type === type).length;

console.log(
  `Showroom: ${count('Showroom')}  Fixtures: ${count('Fixture')}  Frames: ${count('Optical frame') + count('Sunglasses')}`,
);
console.log(
  `Contact lens and care products: ${count('Contact lenses') + count('Lens care')}  Library: ${count('Library')}  Textures: ${catalogue.textures.length}`,
);
if (missing.length) console.error('Missing files:\n  ' + missing.join('\n  '));
if (unlisted.length) console.error('Files not in catalogue.json:\n  ' + unlisted.join('\n  '));
if (missing.length || unlisted.length) process.exit(1);
console.log(`All ${listed.length} asset files are present.`);
