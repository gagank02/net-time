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

test('toggle switches instantly and persists across reloads with no flash', async ({ page }) => {
	await page.emulateMedia({ colorScheme: 'light' });
	await page.goto('/');
	const dark = page.getByRole('button', { name: 'Dark' });
	await expect(dark).toBeEnabled(); // hydrated
	await dark.click();
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
	await expect(dark).toHaveAttribute('aria-pressed', 'true');
	await expect.poll(() => bg(page)).toBe(black);

	// The inline head script applies the saved choice before first paint: already dark at
	// DOMContentLoaded, before the app's JS hydrates.
	await page.reload({ waitUntil: 'domcontentloaded' });
	expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('dark');
	await expect(page.getByRole('button', { name: 'Dark' })).toHaveAttribute('aria-pressed', 'true');

	await expect(page.getByRole('button', { name: 'System' })).toBeEnabled();
	await page.getByRole('button', { name: 'System' }).click();
	await page.reload();
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'system');
	expect(await bg(page)).toBe(grouped);
});

test('tampered storage falls back to the device setting', async ({ page }) => {
	await page.addInitScript(() => localStorage.setItem('theme', '"><img src=x onerror=alert(1)>'));
	await page.goto('/');
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'system');
	await expect(page.getByRole('button', { name: 'System' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
});

test('without JavaScript the toggle is hidden and the device setting applies', async ({
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
	await expect(page.getByRole('group', { name: 'Appearance' })).toBeHidden();
	expect(await bg(page)).toBe(black);
	await context.close();
});
