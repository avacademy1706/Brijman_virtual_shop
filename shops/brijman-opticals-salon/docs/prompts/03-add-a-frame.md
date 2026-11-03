# Prompt for Claude Code: add a frame

Use in Claude Code from the project folder: `Follow @docs/prompts/03-add-a-frame.md` and describe the frame (for example: "a women's acetate cat-eye, 53□16-140, 24 g, in black and honey tortoise, ₹3,490").

---

Read `CLAUDE.md` first (security rules, then the conventions). Change only `src/data/catalogue.js` unless the frame needs a shape that does not exist yet.

1. Find the closest existing frame in `src/data/catalogue.js` (same section and shape) and copy its `F(...)` line. Give it the next free id in its section's letter series (`m`, `w`, `s`, `k`, `p`), a name, the section, the archetype (`NY.ARCH` in `src/data/frames.js`), the material, the price in rupees, `[lens, bridge, temple]` in millimetres for size M, the weight in grams, its colours (from `C`, or a new colour object; sunglasses use `sunC(frame, lens)`), and a one-sentence description in formal English.
2. If no archetype fits, add one to `NY.ARCH` (and, for a new outline, to `NY.SHAPES`, `NY.SHAPE_LABEL` and `NY.FACES`) without changing how existing frames look, and say so in the report.
3. Show it: add its id to the right list in `NY.MERCH` (a niche wall, an island, the Atelier wall or the kids' niche). Every colour must be on display somewhere; the unit tests check this and that every fixture is filled exactly.
4. Check it: with `npm run dev`, tap it in the salon, open the 3D viewer in every colour and size, and open `/tools/tryon-sim.html?pid=<id>` (try `&size=S`, `&yaw=25`, `&temples=128`).
5. Run `npm test` (frame sizes, real width, merchandising), `npm run build` and `npm run format`.
6. Report the new id, its sizes and frame widths, where it is displayed, and screenshots if you took any. Do not commit or deploy.
