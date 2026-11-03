import { NY } from '../src/core/ny.js';
import '../src/data/catalogue.js';
import { buildPiece } from '../src/jewel/build.js';
const money = (n) => '₹' + Math.round(n).toLocaleString('en-IN');
for (const p of NY.PRODUCTS) {
  const cfg = NY.defaultCfg(p);
  const pr = NY.priceOf(p, cfg);
  const out = [p.id.padEnd(4), p.name.padEnd(30), money(pr.total).padStart(12), (pr.weight + 'g').padStart(7)];
  for (const q of [0.35, 0.9]) {
    try {
      const t0 = performance.now();
      const kit = buildPiece(p.build, NY.buildCfg(p, cfg), q);
      const t1 = performance.now();
      const b = kit.bounds();
      const sz = b.getSize(new (await import('three')).Vector3());
      out.push(
        `q${q}: ${Math.round(kit.tris() / 100) / 10}k tris ${kit.gems.length}g ${kit.pearls.length}p ${Math.round(t1 - t0)}ms [${sz.x.toFixed(0)}x${sz.y.toFixed(0)}x${sz.z.toFixed(0)}]`,
      );
    } catch (e) {
      out.push('ERROR ' + e.message + ' ' + e.stack.split('\n')[1]);
    }
  }
  console.log(out.join(' '));
}
