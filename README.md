# Genki application

My application for the Lead Web Engineer role at Genki, built as a small one-page site with the same stack and guardrails I'd use at work: Astro, TypeScript, SCSS Modules, one React island, GitHub Actions and Cloudflare Pages.

I built it with Claude Code. The prompts I used, what worked and what I changed are in [`PROMPTS.md`](PROMPTS.md), and the rules the agent worked to are in [`CLAUDE.md`](CLAUDE.md).

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
4. Playwright smoke test, desktop and mobile Chromium. It checks the headings, that the React island hydrates under the CSP and works from the keyboard, that the page works with JavaScript off, that the CV link serves a PDF and that `_headers` sets the security headers.
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
