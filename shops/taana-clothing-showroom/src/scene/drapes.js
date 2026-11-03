// Baked resting drapes for the store displays (see scripts/bake-drapes.mjs).
import INDEX from '../generated/drapes.json';

/** Load the quantised drape buffer once; returns a lookup that decodes positions on demand. */
export async function loadDrapes() {
  const url = (import.meta.env.BASE_URL || '/') + 'drapes/drapes.bin?v=' + INDEX.hash;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Drapes missing (' + res.status + '). Run npm run bake.');
  const buf = await res.arrayBuffer();
  const decode = (it) => {
    const q = new Int16Array(buf, it.o, it.n * 3);
    const out = new Float32Array(it.n * 3);
    const bb = it.bb;
    for (let i = 0; i < out.length; i += 3)
      for (let k = 0; k < 3; k++) out[i + k] = bb[k] + ((q[i + k] + 32768) / 65535) * (bb[k + 3] - bb[k]);
    return out;
  };
  return {
    index: INDEX,
    has: (key) => !!INDEX.items[key],
    get(key) {
      const it = INDEX.items[key];
      if (!it) return null;
      if (it.pieces) return it.pieces.map(decode);
      return decode(it);
    },
  };
}
