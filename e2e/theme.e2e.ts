import { expect, test, type Page } from './fixtures';

const bg = (page: Page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
const black = 'rgb(0, 0, 0)';
const grouped = 'rgb(242, 242, 247)';
// API requests must look same-origin, or the CSRF check (rightly) rejects them.
const origin = 'http://localhost:4173';

test('follows the device setting by default', async ({ page }) => {
	await page.emulateMedia({ colorScheme: 'dark' });
	await page.goto('/');
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'system');
	expect(await bg(page)).toBe(black);

	await page.emulateMedia({ colorScheme: 'light' });
	expect(await bg(page)).toBe(grouped);
});

test('toggle switches instantly and persists across reloads', async ({ page }) => {
	await page.emulateMedia({ colorScheme: 'light' });
	await page.goto('/');
	const dark = page.getByRole('button', { name: 'Dark' });

	const saved = page.waitForResponse((r) => r.url().endsWith('/theme') && r.status() === 204);
	await dark.click();
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
	await saved;
	await expect(dark).toHaveAttribute('aria-pressed', 'true');
	await expect.poll(() => bg(page)).toBe(black);

	// Server renders the saved choice: correct on first paint, before any JS runs.
	await page.reload();
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
	expect(await bg(page)).toBe(black);
});

test('works without JavaScript', async ({ browser, extraHTTPHeaders }) => {
	const context = await browser.newContext({
		extraHTTPHeaders,
		javaScriptEnabled: false,
		colorScheme: 'dark'
	});
	const page = await context.newPage();
	await page.goto('/');
	await page.getByRole('button', { name: 'Light' }).click();
	await expect(page).toHaveURL(/\/$/);
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
	expect(await bg(page)).toBe(grouped);
	await context.close();
});

test('theme cookie is HttpOnly and SameSite=Lax', async ({ request }) => {
	const res = await request.post('/theme', {
		form: { theme: 'dark' },
		headers: { accept: 'application/json', origin }
	});
	expect(res.status()).toBe(204);
	const cookie = res.headers()['set-cookie'];
	expect(cookie).toMatch(/^theme=dark;/);
	expect(cookie).toMatch(/HttpOnly/i);
	expect(cookie).toMatch(/SameSite=Lax/i);
});

test('rejects invalid themes and tampered cookies', async ({ request, page, context }) => {
	expect(
		(await request.post('/theme', { form: { theme: 'neon' }, headers: { origin } })).status()
	).toBe(400);

	await context.addCookies([{ name: 'theme', value: '"><script>alert(1)</script>', url: origin }]);
	await page.goto('/');
	await expect(page.locator('html')).toHaveAttribute('data-theme', 'system');
});

test('no open redirect after saving', async ({ request }) => {
	const res = await request.post('/theme', {
		form: { theme: 'light', redirectTo: '//evil.example/phish' },
		headers: { origin },
		maxRedirects: 0
	});
	expect(res.status()).toBe(303);
	expect(res.headers()['location']).toBe('/');
});
