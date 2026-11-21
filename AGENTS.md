# Agent notes

Static itinerary page. Browsers run `itinerary.html`, `itinerary.js`, and `assets/ceruleanBootswatch.min.css` directly. There is no build and no `dist/`.

## Before you finish

Run:

```bash
npm run check
```

That is the only check CI runs. It checks formatting, ESLint, `tsc --noEmit`, HTML, CSS, spelling, the workflow files, tests with the coverage floor, the size budget, and links.

The pre-commit hook runs the fast subset:

```bash
npm run check:fast
```

`check:fast` skips the link check and actionlint.

## Rules

- Keep it simple, with no new build step.
- Don't add a dependency without a stated reason.
- Keep archived content.
- Every bug fix gets a test.
- Never lower the coverage floor or the size budget.
- Don't make visible UI changes unless asked.
- Keep existing URLs working: `index.html`, `itinerary.html`, `itinerary.js`, `assets/ceruleanBootswatch.min.css`, and the README link on the index page.

## Why these tools are here

Dev-only. None of them are sent to the browser.

- `typescript` checks JSDoc with `tsc --noEmit` and emits nothing.
- `@types/node` types the Node scripts and tests for that check.
- `eslint`, `@eslint/js`, and `globals` lint JS.
- `prettier` formats.
- `html-validate` checks the HTML pages.
- `stylelint` and `stylelint-config-standard` check CSS.
- `linkinator` checks links in the HTML pages.
- `lefthook` runs `npm run check:fast` before a commit.
- `codespell` (pip, `requirements-dev.txt`) spells. The npm package named codespell is a different project.
- actionlint `1.7.12` is downloaded by `scripts/actionlint.js` from the official release. There is no maintained npm CLI.

## CI

`.github/workflows/ci.yml` runs on push and pull_request. The job has `contents: read`, installs Node 24, runs `npm ci`, then `npm run check`.

`lefthook.yml` is the pre-commit hook. `npm install` installs it through the `prepare` script. If git uses a custom `core.hooksPath`, the installer writes the hook there. Dependabot groups npm, pip, and GitHub Actions updates weekly.

The coverage floor is the `--test-coverage-*` flags on `test:ci` in `package.json`. The size budget is `maxBytes` in `size-budget.json`.

Branch protection cannot be set from this repo's workflow. Require the `check` job on `master` in the repository settings.
