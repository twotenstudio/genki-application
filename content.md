# Page copy

The source for every word on the page. Components use this copy exactly as written. Every fact here comes from my CV.

## 1. Intro

**Eyebrow:** Lead Web Engineer application for Genki

**Name:** Liam Trubshaw

**Lede:** I'm a hands-on engineering lead in London. I've owned technical direction at TwoTen Studio for 8 years while building every week, and this year I took Frame Foundry from idea to paying customers in 6 months.

**Second line:** I built this page the way I'd work at Genki, with Claude Code, clear guardrails and a safe deploy pipeline.

## 2. What I've built

### Frame Foundry

**Meta:** Co-Founder, 2026 to now

A multi-tenant SaaS membership platform, taken from idea to paying customers in 6 months. I built it end to end in Next.js, React and TypeScript, with 81 tables and 70 migrations in Prisma, a preview deployment for every change and weekly releases behind feature flags. Tenants are isolated with row-level security in Postgres.

**Tags:** Next.js, TypeScript, PostgreSQL, Prisma, Vercel

### Events platform on Amazon EKS

**Meta:** TwoTen Studio, during Covid

A WordPress Multisite virtual events platform for a large London events agency. I architected it, containerised it with Docker and load-balanced it on Amazon EKS.

**Tags:** Docker, Amazon EKS, WordPress Multisite

### Shared starter codebases and block libraries

**Meta:** TwoTen Studio, 2018 to now

Starter codebases, component libraries and plugins shared across many client sites, so every new project started from the same foundations. Libraries of React blocks with guardrails let non-technical marketing teams build and publish pages safely without a developer.

**Tags:** React, TypeScript, GitHub Actions, Playwright

## 3. An architectural bet I lived with

At Frame Foundry I put every customer organisation in one shared Postgres database, with a tenant ID on every row. For a small team shipping weekly, one schema meant one set of migrations, one backup and one place to look when something broke. A database per tenant would have multiplied that work before we had the customers to justify it.

The cost is that isolation depends on every query remembering its tenant filter, and one missed filter could show one organisation another's data. So once the data model settled, I rolled out row-level security. Now the database itself blocks access to other organisations' rows, and the filter in the application is the first check rather than the only one.

## 4. How I work with AI agents

I use Claude Code every day, and over the last 2 years I rebuilt my team's workflow around it. I give it clear rules and a plan to work to, then check what it produces through review and automated tests before anything ships.

These are the real prompts from building this page, with what worked and what I changed.

(The steps themselves live in `src/data/agent-steps.json` and `PROMPTS.md`.)

## 5. Letting non-engineers ship safely

At TwoTen I built libraries of React blocks with guardrails, so marketing teams could build and publish pages without a developer. At Genki I'd set it up the same way.

1. **Starter templates.** New pages and components start from a shared starter with the design tokens, accessibility defaults and tests already in place.
2. **Required review.** Every change goes through a pull request, and an engineer reviews anything that touches shared components.
3. **Automated checks.** CI runs lint, type checks, Playwright tests and Lighthouse on every pull request, so the obvious problems are caught before a person has to look.
4. **Preview deploys.** Every pull request gets its own preview URL, so whoever made the change can check it on a real phone before anything reaches production.

This page is built and deployed the same way.

## 6. Links

- **Email:** liamtrubshaw@gmail.com
- **LinkedIn:** linkedin.com/in/liam-trubshaw
- **GitHub:** The source for this page, with the prompts and CI
- **CV:** Download my CV (PDF)

**Footer:** Built with Astro, TypeScript and SCSS Modules. Hosted on Cloudflare Pages.

## Page meta

**Title:** Liam Trubshaw, Lead Web Engineer application for Genki

**Description:** Liam Trubshaw's application for Lead Web Engineer at Genki: what I've built, an architectural bet I lived with, and how I work with AI agents.

## Interface text

- **Project tags list label (screen readers):** Technologies
- **Step tabs label (screen readers):** Build steps
- **Step heading:** Step 1 of 7
- **Step parts:** The prompt / What worked / What I changed
- **Step buttons:** Previous step / Next step

## 404 page

**Title:** Page not found, Liam Trubshaw

**Description:** There's nothing at this address. Liam Trubshaw's application for Lead Web Engineer at Genki is on the home page.

**Heading:** Page not found

**Body:** There's nothing at this address.

**Link:** Go to the application
