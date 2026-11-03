# Using your own 3D jewellery models

Every piece in the boutique is built by code unless you give it a 3D model. Put a model file in `models/jewellery/`, named after the product id, run one command, and that piece is replaced everywhere: in the store, in the product viewer and in the camera try-on. Changing the metal or the stones, the sparkle on diamonds, ring and bangle sizes, and prices all keep working.

---

## 1. Quick start

```bash
# 1. put the file in the folder, named after the product id (see src/data/catalogue.js or the table below)
models/jewellery/p03.glb

# 2. import it
npm run models

# 3. look at it
npm run dev     # then open http://localhost:5173/tools/gallery.html?id=p03
```

`npm run models` prints one line per model: the units it found, the size in millimetres, triangles and file size for the full and the store version, and the stones it found by role. Read the notes at the end of the line; they say when it had to guess.

Commit the results: `public/jewellery/*.glb` and `src/data/jewellery-models.json` (and the source file in `models/jewellery/` so the import can be repeated). To go back to the built-in piece, delete the source file and run `npm run models` again.

Product ids: rings `s01`–`s07`, `g01`, `g03`, `g05`, `e09`, `p07`; earrings `d03`, `d06`, `e03`, `e05`, `g06`, `p03`, `t03`; necklaces and pendants `d01`, `d02`, `d07`, `e01`, `e02`, `e06`, `e10`, `g02`, `g04`, `p01`, `p02`, `t01`, `t02`, `t05`; bangles and bracelets `d04`, `d05`, `e04`, `e07`, `e08`, `g07`, `p05`, `t04`; tikka `p04`, `t06`; nath `p06`. The full list with names is in `src/data/catalogue.js`, or run `node tools/piece-report.mjs`.

---

## 2. What the 3D team should deliver

| Item                 | Requirement                                                                                                                                                                                                                                        |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Format               | **GLB** (glTF 2.0 binary) preferred; `.gltf` and `.obj` also work. From 3ds Max: File → Export → glTF (or the Babylon.js exporter). From Blender: File → Export → glTF 2.0, format "glTF Binary". FBX: export GLB from 3ds Max or Blender instead. |
| One file per product | Named exactly as the product id: `p03.glb`.                                                                                                                                                                                                        |
| Real size            | Model at real size, in any unit (mm, cm, m or inches are detected automatically). Rings at the catalogue's default size (size 12 for women, 20 for men; bangles 2.4).                                                                              |
| Separate parts       | Metal, stones and pearls as separate objects or materials, named so the importer can tell them apart (below). Each stone a closed mesh of its own (as usual).                                                                                      |
| Triangles            | Up to about 100,000 per piece. More is reduced automatically; the store gets a lighter copy on its own.                                                                                                                                            |
| Earrings             | One earring, or the pair side by side.                                                                                                                                                                                                             |
| Pendants             | The pendant with or without its chain. Without a chain, the chain from the catalogue is added.                                                                                                                                                     |
| Textures             | Not needed: metals, stones and pearls get the boutique's own materials and lighting.                                                                                                                                                               |

### Naming parts (materials or objects)

| Name contains                                                     | Becomes                                                   | Shopper can change it                               |
| ----------------------------------------------------------------- | --------------------------------------------------------- | --------------------------------------------------- |
| `gold`, `metal`, anything not listed below                        | Main metal                                                | Yes: 22K, 18K yellow, rose, white, platinum, silver |
| `white`, `claw`, `prong`, `rhodium`                               | Claws (white gold on yellow or rose pieces with diamonds) | Follows the metal                                   |
| `oxid`, `blacken`                                                 | Oxidised recesses (temple and antique work)               | No                                                  |
| `enamel`, `meena`                                                 | Enamel in the material's own colour                       | No                                                  |
| `main`, `centre`, `center`, `solitaire` + a stone word            | Main stone                                                | Yes, if the product offers stone choices            |
| `accent`, `halo`, `pave`, `side`, `small`, `melee` + a stone word | Accent stones                                             | Yes, if offered                                     |
| `drop` + a stone word                                             | Drop stones                                               | Yes, if offered                                     |
| `pearl`, `moti`                                                   | Pearls (round, lustrous)                                  | Pearl colour, if offered                            |

Stone words: `stone`, `gem`, `diamond`, `polki`, `kundan`, `ruby`, `emerald`, `sapphire`, `crystal`, `cz`, `zircon`, `onyx`, `amethyst`, `coral`. A transparent material also counts as a stone. Good names: `Gold_22K`, `Prongs_White`, `Diamond_Main`, `Diamond_Halo`, `Ruby_Main`, `Emerald_Accent`, `Pearl`, `Enamel_Red`.

If the stones carry no role, the group with the largest stones becomes the main stone and the others become accents; a stone named by kind (for example `Ruby`) takes the role the catalogue gives that kind.

### Where the piece is worn (origin)

The importer places every piece the way the boutique expects it, so the 3D team does not have to:

| Type                         | Placement                                                                                                                                                                                 |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ring, bangle, bracelet       | Turned so the finger or wrist runs along z, centred on the hole (found automatically); the ring's head on top. The hole sets the size, so other ring and bangle sizes are scaled from it. |
| Earrings                     | The piercing point: the model's own origin if the artist put it near the top, otherwise just below the highest point.                                                                     |
| Maang tikka, nath            | The hook or piercing (as for earrings). The tikka's chain length is measured for the try-on.                                                                                              |
| Necklace, pendant with chain | Rested on the display bust: the sides of the loop where the neck has widened to the loop's width, the back of the chain touching the back of the neck.                                    |
| Pendant on its own           | Hung at the front of the catalogue's chain.                                                                                                                                               |

---

## 3. When the importer guesses wrong

Put a file with the same id and `.json` next to the model, for example `models/jewellery/p03.json`, then run `npm run models` again:

```json
{
  "units": "cm",
  "rotate": [90, 0, 0],
  "offset": [0, -2, 0],
  "roles": { "Gem_Red": "main", "Gem_Green": "accent", "Bead": "pearl", "Gold_Wire": "metal" },
  "pendantOnly": true
}
```

| Setting       | Use it when                                                                                                                                                           |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `units`       | The size is wrong by 10× or 1000× (`mm`, `cm`, `m`, `in`).                                                                                                            |
| `scale`       | The model is a little too big or small (multiplier, for example `1.05`).                                                                                              |
| `rotate`      | The piece faces the wrong way (degrees about x, y, z, applied in that order; front is +z, up is +y).                                                                  |
| `offset`      | The piece sits a little off where it is worn (millimetres, after the automatic placement).                                                                            |
| `roles`       | A part was sorted wrongly: a part whose material or object name contains the key becomes `main`, `accent`, `drop`, `pearl`, `metal`, `white`, `oxidised` or `enamel`. |
| `pendantOnly` | A pendant was taken for a full necklace, or the other way round.                                                                                                      |

Check the result in `/tools/gallery.html?id=<id>` (every metal), `/tools/tryon-sim.html?pid=<id>` (add `&hand=1` for rings and bangles) and in the store.

---

## 4. What happens to a file

1. Read the file (GLB, glTF or OBJ) and bake every transform into the geometry.
2. Detect the units from the expected size of that kind of piece.
3. Turn and place the piece (table in section 2).
4. Sort parts into metal, claws, oxidised areas, enamel, stones by role, and pearls. Each stone gets its own frame (the direction of its table) so the gem shader can light it like a cut stone and it sparkles; each pearl becomes a lustrous sphere of the same size.
5. Write two files to `public/jewellery/`: the full version (up to 110,000 triangles) for the product viewer and the try-on, and a lighter version for the store (8,000 triangles for a ring up to 26,000 for a necklace), both compressed with meshopt. File names carry a content hash, so browsers cache them for a year and always get a new version when it changes.
6. List both in `src/data/jewellery-models.json`.

In the browser, `src/jewel/source.js` asks for a model first and uses the built-in piece when there is none. If a model file is ever missing or broken, the built-in piece is shown instead, so the boutique never breaks.

Typical sizes after compression: a ring 80–150 KB, earrings 60–150 KB, a necklace 300–600 KB (store versions are smaller). Pieces with a model load from the network instead of being built on the phone, so they usually appear faster on slow phones.

---

## 5. Testing

- `npm test` includes `tests/unit/models.test.js`, which makes designer-style files from built-in pieces (metres, named materials, a ring on its side, a pair of earrings, an OBJ in centimetres), imports them and checks units, placement (within 2.5 mm of the built-in piece), ring hole and size scaling, stone roles, sparkle, budgets, re-import caching and the fallback for a missing file.
- `node tools/sample-models.mjs s02 p03` writes such sample files into `models/jewellery/` to try the whole flow by hand. Delete them afterwards and run `npm run models`.
- `npm run check` fails if a model listed in the manifest is missing from `public/jewellery/`.
