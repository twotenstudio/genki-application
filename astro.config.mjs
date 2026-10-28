// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

export default defineConfig({
  integrations: [react()],
  // No Markdown pages, and Shiki's inline styles don't work under the CSP.
  markdown: { syntaxHighlight: false },
  build: {
    // One small page: inlining the CSS saves a render-blocking request.
    // The CSP below hashes the inlined styles, so no 'unsafe-inline' is needed.
    inlineStylesheets: 'always',
  },
  security: {
    // Astro hashes every inline script and style it emits into a <meta> CSP.
    // Directives a <meta> tag can't carry (frame-ancestors) live in public/_headers.
    csp: {
      directives: [
        "default-src 'self'",
        "img-src 'self'",
        "object-src 'none'",
        "base-uri 'none'",
        "form-action 'none'",
      ],
    },
  },
});
