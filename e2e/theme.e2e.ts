import { expect, test, type Page } from './fixtures';

const bg = (page: Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
const black = 'rgb(0, 0, 0)';
const grouped = 'rgb(242, 242, 247)';

test('follows the device setting by default', async ({ page }) => {
	await page.emulateMedia({ colorScheme: 'dark' });
	await page.goto('/');
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'system');
	expect(await bg(page)).toBe(black);

	await page.emulateMedia({ colorScheme: 'light' });
	expect(await bg(page)).toBe(grouped);
});

const toggle = (page: Page) => page.getByRole('button', { name: 'Dark appearance' });
const stored = (page: Page) => page.evaluate(() => localStorage.getItem('theme'));

test('header button switches instantly, persists with no flash, and can follow the device again', async ({
	page
}) => {
	await page.emulateMedia({ colorScheme: 'light' });
	await page.goto('/');
	await expect(toggle(page)).toBeEnabled(); // hydrated
	await expect(toggle(page)).toHaveAttribute('aria-pressed', 'false');
	await expect(page.locator('header .moon')).toBeVisible();

	await toggle(page).click();
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
	await expect(toggle(page)).toHaveAttribute('aria-pressed', 'true');
	await expect(page.locator('header .sun')).toBeVisible();
	await expect.poll(() => bg(page)).toBe(black);

	// The inline head script applies the saved choice before first paint: already dark at
	// DOMContentLoaded, before the app's JS hydrates, and the icon (pure CSS) already matches.
	await page.reload({ waitUntil: 'domcontentloaded' });
	expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('dark');
	await expect(page.locator('header .sun')).toBeVisible();

	// Back to light matches the device, so the site follows the device again.
	await expect(toggle(page)).toBeEnabled();
	await toggle(page).click();
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'system');
	expect(await stored(page)).toBeNull();
	expect(await bg(page)).toBe(grouped);
});

test('on a dark device the button shows a sun and switches to light', async ({ page }) => {
	await page.emulateMedia({ colorScheme: 'dark' });
	await page.goto('/');
	await expect(page.locator('header .sun')).toBeVisible();
	await expect(toggle(page)).toHaveAttribute('aria-pressed', 'true');
	await toggle(page).click();
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
	expect(await stored(page)).toBe('light');
	await expect.poll(() => bg(page)).toBe(grouped);
});

test('tampered storage falls back to the device setting', async ({ page }) => {
	await page.emulateMedia({ colorScheme: 'light' });
	await page.addInitScript(() => localStorage.setItem('theme', '"><img src=x onerror=alert(1)>'));
	await page.goto('/');
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'system');
	await expect(toggle(page)).toHaveAttribute('aria-pressed', 'false');
});

test('without JavaScript the button is hidden and the device setting applies', async ({
	browser,
	extraHTTPHeaders
}) => {
	const context = await browser.newContext({
		extraHTTPHeaders,
		javaScriptEnabled: false,
		colorScheme: 'dark'
	});
	const page = await context.newPage();
	await page.goto('/');
	await expect(page.locator('header .theme')).toBeHidden();
	expect(await bg(page)).toBe(black);
	await context.close();
});
