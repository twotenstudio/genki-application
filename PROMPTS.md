# Prompts

The prompts I gave Claude Code while building this page, in order. For each one: what was good about the output, and what I changed or rejected and why. The plan from step 2 is in [PLAN.md](PLAN.md).

The page shows the same steps from `src/data/agent-steps.json`. A test fails if the two drift apart.

## 1. Project rules

```
Create a CLAUDE.md for this project. It's a one-page job application site built with Astro, TypeScript and SCSS Modules, deployed to Cloudflare Pages.

Rules:
- TypeScript strict mode, no `any`
- SCSS Modules only, no global styles except a small reset and design tokens
- Accessibility first: semantic HTML, visible focus states, WCAG 2.2 AA contrast, works without JavaScript except the one React island
- Keep JavaScript shipped to the browser to a minimum
- Every change must pass lint, type check and the Playwright smoke test before it's done
- Ask me before adding any dependency
```

**Worked:** It turned my rules into a definition of done with the exact commands to run, so every later step had something concrete to check against.

**Changed:** I added two rules of my own: use my copy exactly as written and flag anything that looks wrong instead of rewriting it, and no em dashes anywhere.

## 2. Plan first

```
Read CLAUDE.md. Plan the site before writing code. Propose the file structure, the components, the design tokens and the CI setup. Don't write any code yet. Keep the plan short and point out anything you're unsure about.
```

**Worked:** It flagged the real risks up front: Astro's inline hydration scripts under a strict CSP, and layout shift when the plain list turns into tabs.

**Changed:** It planned a custom post-build script to hash inline scripts into the CSP. Astro 7 has this built in as security.csp, so I dropped the script and kept _headers for the one directive a meta tag can't carry.

## 3. Scaffold and tooling

```
Scaffold the Astro project from the agreed plan. Add ESLint, Prettier, a strict tsconfig, Playwright with one smoke test that loads the page and checks the main headings, and a GitHub Actions workflow that runs lint, type check, the Playwright test and a Lighthouse check on every pull request. Don't build the page content yet.
```

**Worked:** A strict tsconfig, a flat ESLint config and a CI workflow that runs the same commands as the definition of done, in the same order.

**Changed:** Latest everything didn't fit together. Astro 7 needs a newer Node than I had, so I pinned Node 24 LTS. TypeScript 7 isn't supported by typescript-eslint or astro check yet, so I pinned 6.0, and I used the maintained fork of jsx-a11y because the original doesn't support ESLint 10. Astro 7 also backgrounds its preview server when it detects an AI agent, which left Playwright's server running after the tests, so the test server runs with --ignore-lock.

## 4. Build the sections

```
Build the page sections from the plan as Astro components with SCSS Modules. Use the content in content.md exactly as written, don't rewrite my copy. Mobile first, then tablet and desktop. No JavaScript yet.
```

**Worked:** Each section is one Astro component and one SCSS Module, and the copy matches content.md word for word.

**Changed:** It added a skip link, but there's no navigation before the main content, so it skipped nothing. I took it out.

## 5. The prompts island

```
Build one React island for the "How I work with AI agents" section. It reads steps from a typed JSON file (prompt, what worked, what I changed). It should be keyboard accessible, work with a screen reader, and show all steps as a plain list if JavaScript is off. Keep it small.
```

**Worked:** The server renders every step as a list. After hydration it becomes a proper ARIA tabs pattern with arrow keys, Home and End, so readers without JavaScript lose nothing.

**Changed:** On a phone-sized screen the seven tabs wrapped onto two rows, and the prompts rendered in Courier because browsers give <code> its own monospace font. The tabs now share one row below desktop, and the reset points code at the mono token.

## 6. Review pass

```
Review the whole project as a senior engineer would before a release. Check accessibility, performance, security headers for Cloudflare Pages, unused code and anything that breaks the rules in CLAUDE.md. List the issues first, then fix them one at a time with a short note on each.
```

**Worked:** I ran the review as a separate agent, so it wasn't marking its own work. It found 11 issues, and the best were ones my tests had missed: the Previous and Next buttons hid their own panel and dropped keyboard focus, and on phones the list collapsed by about 3,700px when the island hydrated.

**Changed:** I fixed 10 of the 11, two of them my own way. Fixing the collapse meant reversing my plan: the island now hydrates with client:idle soon after load, not with client:visible as the reader scrolls towards it. It suggested a nowrap class in the page to stop "non-engineers" breaking at the hyphen, but I made the section heading keep hyphenated words whole so the copy stays exactly as written. I kept PLAN.md as the record of the plan and added a note instead of editing it. The broken repo link gets fixed by publishing the repo, not by code.

## 7. Security headers and deploy

```
Add a Cloudflare Pages _headers file with a sensible Content Security Policy, HSTS, X-Content-Type-Options, Referrer-Policy and Permissions-Policy. Make sure the React island still works under the CSP. Then write a short README covering how to run it locally, how CI works and how deploys happen.
```

**Worked:** The headers file and README came out short and accurate. The island already worked under the CSP because Astro hashes its own inline scripts, so the header only adds what a meta tag can't set.

**Changed:** I didn't take "it works under the CSP" on trust. I deleted one hash from the built page and checked the island test failed. The review later pointed out that nothing checked the CSP existed at all, so there's a test for that now too.
