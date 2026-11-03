# Prompt for Claude Code: add a piece of jewellery

Use in Claude Code from the project folder: `Follow @docs/prompts/03-add-a-piece.md` and describe the piece (for example: "an 18K rose gold pear-shaped ruby pendant on a 16 inch chain, about 4 g, making 14%").

---

Read `CLAUDE.md` first (security rules, then the engine conventions). Change only `src/data/catalogue.js` unless the piece needs a builder option that does not exist yet.

1. Find the closest existing piece in `src/data/catalogue.js` (same type and style) and copy its `P.push({...})` entry. Give it the next free id in its salon's letter series, a name, `zone`, `type`, `metals` and default `metal`, weight `wt` in grams at the default size, `making` (fraction), `stones` (role, kind, carats or count), `stoneOptions` if the shopper may change a stone, `tags`, a one-sentence `desc` in formal English, and `tryon` (`ear`, `neck`, `forehead`, `nose`, `finger` or `wrist`).
2. If the client supplied a 3D model for it, put it in `models/jewellery/<id>.glb` and run `npm run models` (see `docs/JEWELLERY-MODELS.md`); the `build` block then only describes the chain for a pendant-only model. Otherwise adjust the `build` block (style, sizes in millimetres, stone cut and size). If no existing style fits, add the option to the matching builder in `src/jewel/build.js` without changing how existing pieces look, and say so in the report.
3. Show it: add it to a niche (necklaces and pendants only), a side case or the counter of its salon in `NY.MERCH`. Counters never hold necklaces or pendants.
4. Check it: `node tools/piece-report.mjs` (price, weight, triangles and size), then with `npm run dev` open `/tools/gallery.html?id=<id>` in each metal, and `/tools/tryon-sim.html?pid=<id>` (add `&hand=1` for rings and bangles).
5. Run `npm test` (it builds every piece in every metal and checks prices and the triangle budget), `npm run build` and `npm run format`.
6. Report the new id, its price breakdown at the default configuration, where it is displayed, and screenshots if you took any. Do not commit or deploy.
