import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { agentSteps } from '../src/data/agent-steps';

const sectionHeadings = [
  "What I've built",
  'An architectural bet I lived with',
  'How I work with AI agents',
  'Letting non\u2011engineers ship safely', // non-breaking hyphen, see index.astro
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

test('loads the page with its main headings', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/');

  await expect(page).toHaveTitle(/Liam Trubshaw/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Liam Trubshaw');
  await expect(page.getByRole('heading', { level: 2 })).toHaveText(sectionHeadings);
  expect(errors).toEqual([]);
});

test('the prompts island hydrates under the CSP and works from the keyboard', async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto('/');
  await page.locator('#agents').scrollIntoViewIfNeeded();

  const tabs = page.getByRole('tablist', { name: 'Build steps' }).getByRole('tab');
  await expect(tabs).toHaveCount(agentSteps.length);
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

test.describe('assets and headers', () => {
  // These don't depend on the viewport, so run them once.
  test.skip(({ isMobile }) => isMobile);

  test('the CV link serves a PDF', async ({ page, request }) => {
    await page.goto('/');
    const href = await page.getByRole('link', { name: /Download my CV/ }).getAttribute('href');
    expect(href).toBeTruthy();

    const response = await request.get(href ?? '');
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('application/pdf');
  });

  test('_headers sets the security headers', () => {
    const headers = readFileSync('dist/_headers', 'utf8');
    for (const name of [
      'Content-Security-Policy',
      'Strict-Transport-Security',
      'X-Content-Type-Options',
      'Referrer-Policy',
      'Permissions-Policy',
    ]) {
      expect(headers).toContain(`${name}:`);
    }
  });
});
