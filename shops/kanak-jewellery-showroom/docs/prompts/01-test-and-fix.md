# Prompt for Claude Code: run every test and fix what fails

Use in Claude Code from the project folder: `Follow @docs/prompts/01-test-and-fix.md`

---

Read `CLAUDE.md` and `docs/TESTING.md` first. Security rules in `CLAUDE.md` come before everything else: never open, print or commit `.env` files.

1. Run `npm run format:check`, `npm test`, `npm run build` and `npm run check`. Fix every failure at its cause in `src/` or `scripts/`. Do not weaken, skip or delete a test to make it pass; if a test is wrong, explain why before changing it.
2. Run `npx playwright install chromium` if the browser is missing, then `npm run test:e2e`. For each failure, open the screenshot under `test-results/` and the trace (`npx playwright show-trace …`), find the cause and fix it.
3. Run `npm audit`. If it reports vulnerabilities, update the affected package to the nearest patched version (pin the exact version), run every test again.
4. Re-run everything until it is green. Run `npm run format`.
5. Report: what failed, the cause, the fix (files changed), and the final test counts. Do not commit or deploy.
