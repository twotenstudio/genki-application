# CLAUDE.md

A one-page job application site for the Lead Web Engineer role at Genki. Built with Astro, TypeScript and SCSS Modules, deployed as a static Cloudflare Worker.

## Rules

- TypeScript strict mode. No `any`, no `@ts-ignore`, no non-null assertions to silence the compiler.
- SCSS Modules only. The only global styles are the reset and the design tokens in `src/styles/`.
- Accessibility first: semantic HTML, visible focus states, WCAG 2.2 AA contrast in light and dark mode.
- The page must work with JavaScript off. The one exception is the React island in the "How I work with AI agents" section, and it must still show its content as a plain list without JavaScript.
- The island map (`src/game/`) is a layer over the page, never a replacement. It's plain TypeScript and canvas with no framework or dependencies. With JavaScript off, with reduced motion, or after "Read as a page", the page must read as a normal page.
- Everything the map can do must also work from the keyboard and the Islands list, and be announced to screen readers.
- Keep JavaScript shipped to the browser to a minimum. No new islands without asking.
- Ask before adding any dependency, including dev dependencies.
- Use the copy in `content.md` exactly as written. Don't rewrite it. If copy looks wrong, say so instead of changing it.
- No em dashes anywhere in copy, code comments or docs.

## Definition of done

A change is done when all of these pass:

```bash
npm run lint       # ESLint and Prettier
npm run check      # astro check (TypeScript, including .astro files)
npm run build      # Astro build (CSP hashes are generated here)
npm test           # Playwright smoke test against the built site
```

CI runs the same commands plus a Lighthouse check on every pull request.

## Project notes

- Node 24 LTS (see `.nvmrc`). Astro 7 needs Node 22.23 or newer.
- Cloudflare Workers Builds deploys `main` and uploads a preview for every other branch. `wrangler.jsonc` must keep the Worker's name (`liam-trubshaw`). `npx wrangler deploy --dry-run` checks the config without deploying.
- Astro's `security.csp` hashes every inline script and style into a `<meta>` CSP. `public/_headers` adds the headers a `<meta>` tag can't set. Never add `'unsafe-inline'` to the CSP.
- `src/scripts/choose-view.js` is inlined at the top of `<body>` to pick the map or the page before first paint. Astro doesn't hash inline scripts, so `Base.astro` hashes it with `Astro.csp.insertScriptHash`. Keep it after the CSP `<meta>`, which Astro writes at the end of `<head>`.
- Map colours are `--world-*` custom properties in `World.module.scss`, read by `src/game/draw.ts`, so the map follows light and dark mode.
- Agent steps for the island live in `src/data/agent-steps.json`, typed by `src/data/agent-steps.ts`. Keep them in sync with `PROMPTS.md`.
