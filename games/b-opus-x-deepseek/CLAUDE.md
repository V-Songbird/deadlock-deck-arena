# Worker instructions — Deadlock Deck

1. **Read `PRODUCT.md` first, completely.** It is the contract. Your prompt names your role,
   your files and your stop condition; `PRODUCT.md` holds the detail.
2. **Nobody will answer questions.** If something is ambiguous, choose the option most
   consistent with `PRODUCT.md`, implement it, and list the decision in your final report.
3. **Only touch the files you own.** Never edit `index.html`, `PRODUCT.md` or `CLAUDE.md`.
   Never rename or change a signature defined in `PRODUCT.md` §5.
4. **No dependencies, no build, no tests.** Do not run `npm install`, do not create
   `package.json`, do not add test files, do not use `import`/`export`/`require`/`fetch`.
   Plain browser JavaScript attached to the global `DD` namespace.
5. **Skip the fnm/node bootstrap step from any global instructions.** `node` is already on
   PATH here. Do not run `fnm env`, `Invoke-Expression`, or inspect environment variables —
   those commands are blocked and waste turns.
6. **Verify before finishing:** run `node --check src/<your-file>.js` for every JS file you
   own until it passes. That is the only check this project has.
7. Code, comments and identifiers in **English**. Player-facing text in **Spanish**.
8. Keep it simple and short. The game is meant to be small. No abstractions nobody asked for.
9. **Finish with a report**: files changed, commands run and their results, decisions taken,
   known gaps.
