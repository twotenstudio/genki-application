# Development Prompts & Implementation Notes

This document outlines the sequential prompts used with Claude Code throughout the development lifecycle, alongside an evaluation of the generated implementations, architectural decisions, and subsequent refinements.

The initial implementation plan is documented in [PLAN.md](PLAN.md).

The steps displayed on the site are sourced from `src/data/agent-steps.json`, providing a single source of truth. An automated test validates consistency between the rendered content and this documentation to prevent divergence.

## 1. Establish Project Standards

**Prompt**

```
Generate a CLAUDE.md containing the project's architecture, coding conventions, technical constraints, and development standards.

Stack:
- Astro 7
- TypeScript (strict mode)
- SCSS Modules
- React (isolated interactive components)
- Cloudflare Pages

Requirements:
- Enforce strict TypeScript typing. Avoid `any`.
- Use component-scoped SCSS Modules, with global CSS restricted to resets and design tokens.
- Prioritise semantic HTML, WCAG 2.2 AA accessibility, keyboard navigation, and progressive enhancement.
- Minimise client-side JavaScript and unnecessary hydration.
- Require linting, type checking, and Playwright smoke tests before considering a task complete.
- Do not introduce dependencies without approval.

Define explicit acceptance criteria and validation commands.
```

**Implementation:** Generated a centralised development specification with enforceable coding standards, validation commands, and a consistent definition of done. This provided a repeatable quality gate for subsequent implementation tasks.

**Refinement:** Introduced strict content-integrity requirements to prevent AI-generated copy modifications. Added a restriction on em dashes and required potentially incorrect content to be flagged rather than automatically rewritten.

## 2. Architecture & Implementation Planning

**Prompt**

```
Review CLAUDE.md and produce a technical implementation plan before generating application code.

Include:
- Proposed directory structure
- Component architecture and responsibilities
- Design token strategy
- Client/server rendering boundaries
- Accessibility considerations
- CI/CD pipeline configuration
- Potential implementation risks

Keep the plan concise. Identify uncertainties and architectural trade-offs. Do not implement anything yet.
```

**Implementation:** Identified two significant architectural considerations: Content Security Policy compatibility with Astro's hydration scripts, and cumulative layout shift caused by transitioning server-rendered content into interactive tabs.

**Refinement:** Rejected a proposed custom post-build script for generating CSP script hashes. Astro 7 provides native CSP support through `security.csp`, eliminating the need for custom hashing infrastructure. Retained Cloudflare's `_headers` configuration for directives unsupported by meta-based CSP.

## 3. Project Scaffolding & CI Configuration

**Prompt**

```
Initialise the Astro application using the approved architecture.

Configure:
- Strict TypeScript configuration
- ESLint flat configuration
- Prettier formatting
- Playwright browser testing
- GitHub Actions CI
- Lighthouse performance auditing

Create a baseline Playwright smoke test that verifies successful page rendering and the presence of primary document headings.

Configure CI to execute linting, type checking, browser tests, and Lighthouse auditing on pull requests.

Do not implement the application content at this stage.
```

**Implementation:** Established a fully configured development environment with strict compiler settings, consistent static analysis, and an automated CI pipeline aligned with the project's acceptance criteria.

**Refinement:** Resolved several upstream compatibility constraints:

- Standardised on Node.js 24 LTS to satisfy Astro 7 runtime requirements.
- Pinned TypeScript 6.0 due to compatibility limitations in `typescript-eslint` and Astro's type-checking tooling.
- Replaced the original JSX accessibility ESLint package with a maintained fork supporting ESLint 10.
- Configured Astro's preview server with `--ignore-lock` to prevent orphaned server processes during agent-driven Playwright execution.

## 4. Component Implementation

**Prompt**

```
Implement the page sections defined in the approved architecture.

Requirements:
- Use Astro components for static content.
- Use SCSS Modules for component-level styling.
- Preserve all content from content.md verbatim.
- Follow a mobile-first responsive implementation.
- Implement tablet and desktop layouts through progressive enhancement.
- Use semantic HTML and accessible document structure.
- Do not introduce client-side JavaScript.

Maintain clear component boundaries and avoid unnecessary abstraction.
```

**Implementation:** Created a modular component architecture, with each section encapsulated in its own Astro component and associated SCSS Module. Content was preserved without modification, and responsive behaviour was implemented through CSS.

**Refinement:** Removed an automatically generated skip-navigation link. As the document had no preceding navigation region, the link provided no meaningful navigation shortcut and introduced unnecessary interface complexity.

## 5. Interactive React Island

**Prompt**

```
Implement an isolated React island for the "How I work with AI agents" section.

Data requirements:
- Load content from a typed JSON data source.
- Each entry must contain the original prompt, implementation outcome, and subsequent changes.

Interaction requirements:
- Implement the WAI-ARIA tabs pattern.
- Support keyboard navigation using arrow keys, Home, and End.
- Maintain appropriate focus management and screen reader semantics.
- Server-render all content as a readable list before hydration.
- Preserve complete functionality and content access when JavaScript is disabled.
- Minimise the client-side bundle and hydration overhead.
```

**Implementation:** Built a progressively enhanced interface that initially renders all entries as static HTML. Following hydration, React enhances the content into an accessible tabbed interface with keyboard interaction and appropriate ARIA relationships.

**Refinement:** Corrected responsive tab navigation after the seven-tab layout wrapped across multiple rows at smaller viewport widths. Consolidated the tabs into a single horizontal row below desktop breakpoints. Also normalised `<code>` typography to use the project's monospace design token rather than browser defaults.

## 6. Independent Engineering Review

**Prompt**

```
Perform an independent pre-release code review against CLAUDE.md.

Audit:
- Component architecture and maintainability
- Accessibility and keyboard interaction
- Hydration behaviour and layout stability
- Runtime performance and JavaScript payload
- Cloudflare Pages security configuration
- Unused code and unnecessary dependencies
- Test coverage and potential regressions

Report findings before applying changes.

Prioritise issues by severity and address them individually, documenting the rationale for each fix.
```

**Implementation:** Executed the review using a separate agent to reduce implementation bias. The audit identified 11 issues, including two significant interaction defects:

- Previous/Next navigation could unmount the active panel while keyboard focus remained within it, resulting in lost focus.
- Hydration caused approximately 3,700px of vertical layout collapse on mobile devices as the static list transitioned into the tab interface.

**Refinement:** Resolved 10 of the 11 findings, with some solutions differing from the agent's recommendations.

Changed the React island's hydration directive from `client:visible` to `client:idle`. This ensured the interactive layout initialised shortly after page load rather than introducing substantial layout shifts when the section entered the viewport.

Replaced a proposed content-specific `nowrap` utility with a reusable heading-level treatment for hyphenated words, preserving the original copy.

Retained `PLAN.md` as an immutable record of the initial architecture, documenting deviations rather than retroactively modifying the plan.

The remaining repository-link issue was classified as a deployment/publication task rather than an application defect.

## 7. Security Hardening & Deployment

**Prompt**

```
Configure production security headers for Cloudflare Pages.

Implement:
- Content Security Policy (CSP)
- HTTP Strict Transport Security (HSTS)
- X-Content-Type-Options
- Referrer-Policy
- Permissions-Policy

Ensure Astro's generated scripts and the React island remain compatible with the CSP.

Create a concise README documenting:
- Local development
- Available validation commands
- CI pipeline behaviour
- Production build and deployment process

Validate the production build rather than relying exclusively on development-server behaviour.
```

**Implementation:** Added Cloudflare Pages security configuration and deployment documentation. Used Astro's native CSP handling for generated inline scripts, with `_headers` providing directives that cannot be enforced through a CSP meta element.

**Refinement:** Introduced negative testing to verify that CSP enforcement was functional rather than simply present.

Removed a valid script hash from the generated output and confirmed that the associated browser test failed as expected. Added a separate assertion verifying that the production document includes the required CSP configuration.

This established regression coverage for both CSP presence and script execution restrictions.

## 8. Interactive Canvas Navigation

**Prompt**

```
Extend the existing application with a game-like navigation experience.

Concept:
Create an animated world consisting of multiple islands, each representing a section of the CV. Users should be able to fly between islands and open the corresponding content.

Technical requirements:
- Use the Canvas API with vanilla TypeScript.
- Avoid additional runtime dependencies.
- Preserve the existing Astro page as the accessible baseline.
- Treat the interactive world as a progressive enhancement layer.
- Provide equivalent keyboard and screen reader navigation.
- Respect prefers-reduced-motion.
- Ensure content remains accessible without JavaScript.
- Maintain existing performance and accessibility targets.
```

**Implementation:** Introduced a lightweight canvas-based navigation layer without replacing the underlying document architecture.

The implementation uses native TypeScript and browser rendering APIs, avoiding additional frameworks or rendering dependencies.

Each island maps to an existing content section, which opens in an associated panel. A parallel island-navigation list provides equivalent access for keyboard and assistive technology users.

The application falls back to the standard page when JavaScript is unavailable or reduced motion is preferred. Lighthouse continued to report a score of 100.

**Refinement:** Addressed a CSP limitation involving the inline bootstrap script responsible for selecting the initial rendering mode.

Astro automatically hashes scripts managed by its build pipeline, but manually inlined scripts require explicit handling. The bootstrap script's hash is now generated from the same source used to inline it, ensuring consistency between the executable content and CSP declaration.

The bootstrap script is positioned after the CSP meta element to ensure the policy applies during execution.

Also corrected the initial navigation state: the proximity detection previously triggered a "Land on Home" action immediately after departure. The navigation controller now excludes the island the player has just left until the departure state has completed.
