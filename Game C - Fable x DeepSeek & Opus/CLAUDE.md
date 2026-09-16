# Worker instructions — Deadlock Deck

1. Read `PRODUCT.md` first. It is the contract; the JSDoc in the `js/` stubs is normative.
2. Vanilla JavaScript only: no dependencies, no build step, no tests, no ES modules, no network,
   no `fetch`. `index.html` must run from `file://`.
3. Touch only the files you own (ownership table in `PRODUCT.md` §2). Never rename or remove a
   name or signature that exists in a stub; add private helpers inside your own file only.
4. Code, comments and identifiers in English. Every player-facing string in Spanish.
5. `node` and `npm` are already on PATH. Do not run `fnm`, do not inspect environment variables,
   do not install anything, do not create a git repository.
6. Checks: `node --check js/<file>.js` for syntax; for pure-logic files run a throwaway node script
   (see `PRODUCT.md` §11) and delete it afterwards. Browser-only files (sprites, audio, ui) get the
   syntax check plus careful reading.
7. Nobody will answer questions. Choose the option most consistent with `PRODUCT.md`, then list it
   under "Decisions" in your report.
8. Finish with a report: files changed, commands run and results, decisions, known gaps.
