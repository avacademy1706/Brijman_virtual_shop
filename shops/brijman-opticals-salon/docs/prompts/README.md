# Prompts for Claude Code

Ready-made task prompts for [Claude Code](https://claude.com/claude-code) in VS Code. Open the project folder, start Claude Code and type, for example:

```
Follow @docs/prompts/01-test-and-fix.md
```

| Prompt                   | Task                                                                                       |
| ------------------------ | ------------------------------------------------------------------------------------------ |
| `01-test-and-fix.md`     | Run formatting, unit, build and browser tests and `npm audit`; fix failures at their cause |
| `02-responsive-audit.md` | Check the layout on every screen size and fix what is cut off, overlapping or too small    |
| `03-add-a-frame.md`      | Add a new frame to the catalogue, display it in the salon and test it                      |

Claude Code also reads `CLAUDE.md` in the project root automatically; it holds the architecture, conventions and security rules.

## The same tasks as slash commands

The prompts are also installed as Claude Code skills in `.claude/skills/`, so in the Claude Code panel you can type `/test-and-fix`, `/responsive-audit`, `/add-a-frame <description>` or `/predeploy-check` (checks the project is ready for Vercel: format, tests, build with the try-on models, assets, `npm audit`, secrets, `vercel.json`). They run only when you type them.

`.claude/settings.json` stops Claude Code reading `.env` files and lets it run the test and build scripts without asking each time.
