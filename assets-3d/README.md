# 3D assets

Every model and texture from the virtual showroom, exported as glTF 2.0 binary files (`.glb`). These are for 3D artists, presentations, renders, AR and reuse in other projects.

The website does **not** load these files. It builds the same store, fixtures and frames in code (`src/scene/showroom.js`), so the site stays small and fast. This folder is excluded from Vercel deployments by `.vercelignore`. To offer a model for download on the site, copy it into `public/models/`.

| Folder | Contents | Files |
| --- | --- | --- |
| `showroom/` | `Nayan_Showroom.glb`: the complete store with every fixture and all 188 products on display, grouped by fixture and by section | 1 |
| `fixtures/` | Each fixture on its own, moved to its own floor point: wall bays, sunglasses island, lens bar, vitrines, eye test room, counters, desk, totem, stools, plants, shell, storefront, lighting, signs | 39 |
| `frames/<Section>/` | Every frame style in every colour, one file each, at true size. Named `SKU_Name_Colour.glb` | 92 |
| `frames/Nayan_Frame_Library.glb` | All 92 frames on one grid: rows are styles, columns are colours, 220 mm apart | 1 |
| `products/` | Contact lens boxes and lens care products (solution, drops, case kit), one unit each | 7 |
| `textures/` | Source textures as PNG: terrazzo, walnut, oak, tortoise (havana and honey), fluted panel normal map, Snellen chart, directory screen, lens bar screen, box label, soft shadow masks | 13 |
| `textures/signs/` | Every shop sign as a transparent PNG | 10 |
| `catalogue.json`, `catalogue.csv` | One row per file: type, SKU, name, colour, section, shape, material, size in mm, weight, price, store position, triangle count, file size | |

Run `npm run assets:check` to confirm every file in the catalogue is present.

## Units and orientation

- **1 unit = 1 metre.** Frames are at real size: a `53-18-145` frame is 53 mm across each lens, with an 18 mm bridge and 145 mm temples.
- **Y is up.** Frames are centred on the bridge, with the front facing +Z and the temples running back along −Z.
- Fixtures are re-centred on their own floor point. Wall bays are turned to face +Z; other fixtures keep their showroom orientation. `position_in_store_m` and `rotation_deg` in `catalogue.csv` give where each one sits in the store.
- Materials are standard glTF PBR (metal/roughness), with clearcoat on acetate frames. Light strips, signs and screens use unlit (self-lit) materials.
- Geometry is indexed and textures are embedded. There is no Draco or Meshopt compression, so the files open in any glTF importer.

## Opening the files

| Tool | How |
| --- | --- |
| Quick look | Drag a `.glb` onto https://gltf-viewer.donmccurdy.com (the file stays in your browser) |
| Blender 3.6+ | File → Import → glTF 2.0 (.glb/.gltf). Units and scale come through as metres. |
| 3ds Max | Use File → Import if your version lists glTF. Otherwise import into Blender and export FBX. |
| Unreal Engine 5 | Drag the `.glb` into the Content Browser (glTF import through Interchange). Import fixtures and frames separately for the cleanest result. |
| Unity | Add the glTFast package, then drag the `.glb` into Assets. |
| Web (three.js) | `new GLTFLoader().load('/models/NY-M01_Arlo_Jet_black.glb', …)` after copying the file to `public/models/` |

## Not included

- **Lighting.** Add your own lights or HDRI. The showroom uses ceiling downlights, the ring light and shelf light strips as visual guides.
- **Contact shadows and the outdoor backdrop.** The website fakes these, so they are left out. Bake proper shadows in your renderer.
- **The products on each fixture.** The fixture files are empty, ready to dress. The full showroom file has every product placed.

## Sample data

The brand "Nayan Eyewear", the frame names, prices and SKUs are placeholders. These files match the sample catalogue. When `src/data/catalogue.js` changes, the website updates by itself, but these model files need to be exported again.
