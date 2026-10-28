import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { agentSteps } from '../src/data/agent-steps';

const sectionHeadings = [
  "What I've built",
  'An architectural bet I lived with',
  'How I work with AI agents',
  'Letting non-engineers ship safely',
  'Links',
];

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

async function openSteps(page: Page) {
  await page.goto('/');
  await page.locator('#agents').scrollIntoViewIfNeeded();
  const tabs = page.getByRole('tablist', { name: 'Build steps' }).getByRole('tab');
  await expect(tabs).toHaveCount(agentSteps.length);
  return tabs;
}

test('loads the page with its main headings', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/');

  await expect(page).toHaveTitle(/Liam Trubshaw/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Liam Trubshaw');
  await expect(page.getByRole('heading', { level: 2 })).toHaveText(sectionHeadings);
  expect(errors).toEqual([]);
});

test.describe('prompts island', () => {
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

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('shows every step as a plain list', async ({ page }) => {
    await page.goto('/');
    const section = page.getByRole('region', { name: 'How I work with AI agents' });

    await expect(section.getByRole('tab')).toHaveCount(0);
    await expect(section.getByRole('listitem')).toHaveCount(agentSteps.length);
    for (const step of agentSteps) {
      await expect(section.getByRole('heading', { name: step.title })).toBeVisible();
    }
  });
});

test.describe('build output', () => {
  // None of these depend on the viewport, so run them once.
  test.skip(({ isMobile }) => isMobile);

  test('the page has a hash-based CSP with no unsafe-inline', async ({ page }) => {
    await page.goto('/');
    const csp = await page
      .locator('meta[http-equiv="content-security-policy"]')
      .getAttribute('content');

    expect(csp).toMatch(/script-src 'self'( 'sha256-[^']+')+/);
    expect(csp).toMatch(/style-src 'self'( 'sha256-[^']+')+/);
    expect(csp).toContain("object-src 'none'");
    expect(csp).not.toContain('unsafe-inline');
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
