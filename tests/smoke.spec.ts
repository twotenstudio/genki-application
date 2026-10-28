import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { agentSteps } from '../src/data/agent-steps';
import { sections } from '../src/data/sections';

const sectionHeadings = sections.map((entry) => entry.title);

/** Collects console errors and uncaught exceptions, which include CSP violations. */
function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => {
    errors.push(error.message);
  });
  return errors;
}

/** Remembers "Read as a page", the same way the toggle does. */
async function choosePageView(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('view', 'page');
  });
}

test.describe('island map', () => {
  test('opens on the map with the welcome panel', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/');

    await expect(page.locator('html')).toHaveClass(/game-ready/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Liam Trubshaw');
    await expect(page.getByRole('button', { name: 'Start flying' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Islands' }).getByRole('link')).toHaveCount(
      sections.length,
    );
    expect(errors).toEqual([]);
  });

  test('flying to an island opens its section, and Escape flies back out', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/');
    await page.getByRole('button', { name: 'Start flying' }).click();

    const link = page.getByRole('link', { name: /What I've built/ });
    await link.click();
    const panel = page.getByRole('dialog', { name: "What I've built" });
    await expect(panel).toBeVisible({ timeout: 10_000 });
    await expect(panel.getByRole('heading', { level: 2 })).toBeFocused();
    await expect(page).toHaveURL(/#built$/);

    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
    await expect(link).toBeFocused();
    await expect(page).not.toHaveURL(/#built$/);
    expect(errors).toEqual([]);
  });

  test('a link to a section opens its island straight away', async ({ page }) => {
    await page.goto('/#links');
    const panel = page.getByRole('dialog', { name: 'Links' });
    await expect(panel).toBeVisible();
    await panel.getByRole('button', { name: 'Back to the map' }).click();
    await expect(panel).toBeHidden();
  });

  test('"Read as a page" switches views and is remembered', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Read as a page' }).click();
    await expect(page.getByRole('heading', { level: 2 })).toHaveText(sectionHeadings);

    await page.reload();
    await expect(page.locator('html')).not.toHaveClass(/game/);
    await expect(page.getByRole('button', { name: 'Explore the islands' })).toBeVisible();
  });

  test.describe('with reduced motion', () => {
    test.use({ reducedMotion: 'reduce' });

    test('starts as a page, with the map one click away', async ({ page }) => {
      await page.goto('/');
      await expect(page.locator('html')).not.toHaveClass(/game/);
      await expect(page.getByRole('heading', { level: 2 })).toHaveText(sectionHeadings);

      await page.getByRole('button', { name: 'Explore the islands' }).click();
      await expect(page.locator('html')).toHaveClass(/game-ready/);
    });
  });
});

test.describe('as a page', () => {
  test.beforeEach(async ({ page }) => {
    await choosePageView(page);
  });

  test('loads with its main headings', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/');

    await expect(page).toHaveTitle(/Liam Trubshaw/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Liam Trubshaw');
    await expect(page.getByRole('heading', { level: 2 })).toHaveText(sectionHeadings);
    expect(errors).toEqual([]);
  });

  test.describe('prompts island', () => {
    async function openSteps(page: Page) {
      await page.goto('/');
      await page.locator('#agents').scrollIntoViewIfNeeded();
      const tabs = page.getByRole('tablist', { name: 'Build steps' }).getByRole('tab');
      await expect(tabs).toHaveCount(agentSteps.length);
      return tabs;
    }

    test('hydrates under the CSP and works from the keyboard', async ({ page }) => {
      const errors = trackErrors(page);
      const tabs = await openSteps(page);
      await expect(tabs.first()).toHaveAttribute('aria-selected', 'true');

      await tabs.first().focus();
      await page.keyboard.press('ArrowRight');
      await expect(tabs.nth(1)).toBeFocused();
      await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
      await expect(page.getByRole('tabpanel')).toContainText(agentSteps[1]?.title ?? '');

      await page.keyboard.press('End');
      await expect(tabs.last()).toHaveAttribute('aria-selected', 'true');
      expect(errors).toEqual([]);
    });

    test('previous and next keep focus inside the widget', async ({ page }) => {
      const tabs = await openSteps(page);

      await page.getByRole('button', { name: 'Next step' }).click();
      await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
      await expect(tabs.nth(1)).toBeFocused();

      await page.getByRole('button', { name: 'Previous step' }).click();
      await expect(tabs.first()).toHaveAttribute('aria-selected', 'true');
      await expect(tabs.first()).toBeFocused();
    });
  });
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('is a plain page, with every step as a list', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 2 })).toHaveText(sectionHeadings);
    await expect(page.getByRole('button', { name: 'Explore the islands' })).toBeHidden();

    const section = page.getByRole('region', { name: 'How I work with AI agents' });
    await expect(section.getByRole('tab')).toHaveCount(0);
    // Only the steps themselves: their notes can hold bullet lists of their own.
    await expect(section.locator('ol').first().locator(':scope > li')).toHaveCount(
      agentSteps.length,
    );
    for (const step of agentSteps) {
      await expect(section.getByRole('heading', { name: step.title })).toBeVisible();
    }
  });
});

test.describe('build output', () => {
  // None of these depend on the viewport, so run them once.
  test.skip(({ isMobile }) => isMobile);

  test('every inline script is allowed by a hash, and nothing by unsafe-inline', async ({
    page,
  }) => {
    await page.goto('/');
    const csp =
      (await page.locator('meta[http-equiv="content-security-policy"]').getAttribute('content')) ??
      '';
    expect(csp).toMatch(/style-src 'self'( 'sha256-[^']+')+/);
    expect(csp).toContain("object-src 'none'");
    expect(csp).not.toContain('unsafe-inline');

    const html = readFileSync('dist/index.html', 'utf8');
    const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)];
    expect(inline.length).toBeGreaterThan(0);
    for (const [, body = ''] of inline) {
      const hash = createHash('sha256').update(body).digest('base64');
      expect(csp).toContain(`'sha256-${hash}'`);
    }
  });

  test('_headers sets the security headers for every path', () => {
    const headers = readFileSync('dist/_headers', 'utf8');
    const allPaths = headers.split(/^\/\*$/m)[1]?.split(/^\S/m)[0] ?? '';

    expect(allPaths).toMatch(/Content-Security-Policy: .*frame-ancestors 'none'/);
    expect(allPaths).toMatch(/Strict-Transport-Security: max-age=\d{8,}/);
    expect(allPaths).toContain('X-Content-Type-Options: nosniff');
    expect(allPaths).toContain('Referrer-Policy: strict-origin-when-cross-origin');
    expect(allPaths).toMatch(/Permissions-Policy: .*camera=\(\)/);
  });

  test('unknown paths get a real 404 page', async ({ page }) => {
    const response = await page.goto('/no-such-page');
    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Page not found');
  });

  test('the CV link serves a PDF', async ({ page, request }) => {
    await choosePageView(page);
    await page.goto('/');
    const href = await page.getByRole('link', { name: /Download my CV/ }).getAttribute('href');
    expect(href).toBeTruthy();

    const response = await request.get(href ?? '');
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('application/pdf');
  });

  test('the steps on the page match PROMPTS.md', () => {
    const prompts = readFileSync('PROMPTS.md', 'utf8');
    for (const step of agentSteps) {
      expect(prompts).toContain(step.title);
      expect(prompts).toContain(step.prompt);
      expect(prompts).toContain(step.worked);
      expect(prompts).toContain(step.changed);
    }
  });
});
