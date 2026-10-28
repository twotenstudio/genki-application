# Plan

Written before any code, from the prompt in step 2 of `PROMPTS.md`.

## File structure

```
src/
  pages/index.astro            the one page, composes the sections
  layouts/Base.astro           html shell, meta, skip link, global styles
  components/
    Section.astro              shared section wrapper (numbered heading, id)
    Intro.astro
    Projects.astro             "What I've built" cards
    ArchitecturalBet.astro
    AgentSteps.tsx             the React island
    ShipSafely.astro
    Links.astro
    *.module.scss              one SCSS Module per component
  data/
    agent-steps.json           steps shown by the island
    agent-steps.ts             AgentStep type and typed export
  styles/
    reset.scss                 small modern reset (global)
    tokens.scss                design tokens as CSS custom properties (global)
    _mq.scss                   breakpoint mixins, imported by modules
public/
  _headers                     security headers template
  favicon.svg
  liam-trubshaw-cv.pdf
scripts/csp.mjs                post-build: hash inline scripts and styles into dist/_headers
tests/smoke.spec.ts            Playwright smoke test
.github/workflows/ci.yml       lint, check, build, test, Lighthouse
```

## Components

Six sections, all static Astro components except `AgentSteps`. Copy is written inline in each component from `content.md`, so the markup reads top to bottom.

`AgentSteps` renders every step as an ordered list on the server. After hydration it switches to an ARIA tabs pattern (roving tabindex, arrow keys, Home and End). Without JavaScript, the reader gets the full list.

## Design tokens

- Colour: background, surface, ink, muted ink, border, accent, focus ring. Light and dark sets via `prefers-color-scheme`, all checked against AA.
- Type: system font stack, a monospace stack for prompts, a fluid scale of five steps using `clamp()`.
- Space: a 4px-based scale from `--space-1` to `--space-9`.
- Layout: content measure of about 65 characters, page max width, one radius, one shadow.
- Breakpoints: 40rem (tablet) and 64rem (desktop), as SCSS mixins since custom properties don't work in media queries.

## CI

One GitHub Actions workflow on pull requests and pushes to `main`:

1. `npm ci`
2. `npm run lint` (ESLint and Prettier)
3. `npm run check` (astro check)
4. `npm run build`
5. `npm test` (Playwright, Chromium only)
6. Lighthouse CI against `dist/`, mobile, failing under 95 for performance and accessibility

Cloudflare Pages' Git integration handles deploys: a preview URL per pull request, production on merge to `main`. No deploy step in Actions, so no Cloudflare tokens in GitHub.

## Unsure about

1. **CSP and Astro's inline scripts.** Astro inlines the island hydration script and a small style tag. A strict CSP needs their hashes, and they change per build. Plan: hash them after the build and write them into `dist/_headers`, rather than allowing `'unsafe-inline'`.
2. **Layout shift when the island hydrates.** Swapping the list for tabs changes the section's height. Plan: hydrate with `client:visible` and a generous `rootMargin`, so the swap happens before the section scrolls into view and the first load ships no JavaScript at all.
3. **Testing under the real headers.** `astro preview` doesn't apply `_headers`. Plan: the Playwright test reads `dist/_headers` and applies them to responses, so it fails if the CSP blocks the island.
4. **React's size.** React and React DOM are about 60kB gzipped for one small widget. Preact would be smaller, but the brief and Genki's stack say React, so React it is, loaded only when needed.

## What changed after the plan

- **No custom CSP script.** Astro 7 has Content Security Policy support built in (`security.csp`). It hashes its own inline scripts and styles into a `<meta>` CSP, so `scripts/csp.mjs` was never written. `public/_headers` carries the directives a `<meta>` CSP can't, such as `frame-ancestors`.
- **Testing under the CSP** needed no header injection, since the `<meta>` CSP ships in the built HTML that `astro preview` serves. I checked the test catches a blocked island by deleting a hash from the built page: it failed as it should.
- **CSS is inlined** (`build.inlineStylesheets: 'always'`), which removes the only render-blocking request. The CSP hashes the inlined styles.
- **No skip link.** The plan listed one, but nothing comes before the main content, so it would skip nothing.
- **`client:idle`, not `client:visible`.** The review measured the no-JavaScript list at about 4,900px on a phone against about 1,150px for the tabs. Hydrating as the reader scrolls towards the section makes that collapse happen on screen. `client:idle` swaps it soon after load, while the section is still below the fold. The cost is that React now loads on every visit, after the page is idle.
