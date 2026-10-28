# Genki application

My application for the Lead Web Engineer role at Genki, built as a small one-page site with the same stack and guardrails I'd use at work: Astro, TypeScript, SCSS Modules, one React island, GitHub Actions and Cloudflare Pages.

I built it with Claude Code. The prompts I used, what worked and what I changed are in [`PROMPTS.md`](PROMPTS.md), and the rules the agent worked to are in [`CLAUDE.md`](CLAUDE.md).

## The island map

On a first visit the page opens as a small game: you fly a seaplane between islands, and landing on one opens that section of the application. It's a layer over the page, not a replacement.

- **Controls:** arrow keys or WASD to fly, Enter to land, or click or tap an island to fly there automatically. Escape or "Back to the map" closes a section.
- **Accessibility:** the canvas is decorative. The Islands list holds real links, so keyboard and screen reader users get the same journeys, with landings announced and focus moved into each panel.
- **The page is always there:** without JavaScript, with `prefers-reduced-motion`, or after "Read as a page", the page reads as a normal page. The choice is remembered.
- **Deep links:** `/#agents` opens that island's panel straight away.
- **How it's built:** `src/game/` is plain TypeScript and canvas, with no framework and no dependencies. Islands are pre-rendered once per resize, and only the moving parts (waves, the lighthouse beam, the crane hook, the plane) are drawn each frame. Map colours are CSS custom properties, so dark mode turns day into night.

## Run it locally

You need Node 24 (see `.nvmrc`). Astro 7 needs Node 22.23 or newer.

```bash
npm ci
npm run dev          # http://localhost:4321
```

To check a change the way CI does:

```bash
npm run lint         # ESLint and Prettier
npm run check        # astro check (TypeScript, including .astro files)
npm run build        # production build into dist/
npx playwright install chromium   # first time only
npm test             # Playwright smoke test against the built site
```

`npm test` serves `dist/`, so build first. Astro's CSP only exists in the production build, so testing the build is the point.

## How CI works

`.github/workflows/ci.yml` runs on every pull request and every push to `main`:

1. Lint and format check
2. Type check
3. Build
4. Playwright smoke test, desktop and mobile Chromium. It flies to an island and back, checks deep links, the view toggle and reduced motion, the headings and keyboard tabs on the page, that the page works with JavaScript off, that every inline script is allowed by a CSP hash, that the CV link serves a PDF and that `_headers` sets the security headers.
5. Lighthouse CI on the built site with mobile settings. It fails the build if performance, accessibility, best practices or SEO drop below 95.

A failing Playwright run uploads its report and traces as an artifact. Dependabot opens weekly pull requests for npm packages and GitHub Actions, and they go through the same checks.

## How deploys happen

Cloudflare Pages deploys straight from GitHub through its Git integration, so there are no Cloudflare tokens in GitHub.

- Every pull request gets its own preview URL, posted on the pull request.
- Merging to `main` deploys to production.
- Branch protection on `main` requires the CI check to pass before merging.

Cloudflare Pages settings:

| Setting                | Value           |
| ---------------------- | --------------- |
| Framework preset       | Astro           |
| Build command          | `npm run build` |
| Build output directory | `dist`          |
| Node version           | from `.nvmrc`   |

## Security headers

Two layers, because neither can do the whole job alone:

- **Astro's `<meta>` CSP** (`security.csp` in `astro.config.mjs`). Astro hashes every inline script and style it emits, including the island's hydration script, so `script-src` and `style-src` never need `'unsafe-inline'`.
- **`public/_headers`** for Cloudflare Pages: HSTS, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options`, `Cross-Origin-Opener-Policy`, and a CSP header for `frame-ancestors`, which a `<meta>` tag can't set. Fingerprinted files in `/_astro/` are cached for a year.

## Project layout

```
src/
  pages/index.astro        the page
  layouts/Base.astro       html shell and meta
  components/              one Astro component and SCSS Module per section
  components/AgentSteps.tsx  the React island
  data/agent-steps.json    the steps the island shows, typed by agent-steps.ts
  styles/                  reset, design tokens and SCSS mixins
tests/smoke.spec.ts        Playwright smoke test
content.md                 the page copy, which components use word for word
```
