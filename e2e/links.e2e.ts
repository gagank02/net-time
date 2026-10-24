import { expect, test } from '@playwright/test';

test('external links open in a new tab safely and say so', async ({ page }) => {
	await page.goto('/');
	const external = page.locator('a[href^="http"]');
	expect(await external.count()).toBeGreaterThan(0);
	for (const link of await external.all()) {
		await expect(link).toHaveAttribute('target', '_blank');
		await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
		await expect(link).toContainText('(opens in a new tab)');
	}
});

test('attribution link opens in a new tab, leaving the app in place', async ({ page, context }) => {
	await context.route('https://www.openstreetmap.org/**', (route) =>
		route.fulfill({ body: 'stub', contentType: 'text/plain' })
	);
	await page.goto('/');
	const [popup] = await Promise.all([
		context.waitForEvent('page'),
		page.getByRole('link', { name: /OpenStreetMap/ }).click()
	]);
	expect(popup.url()).toContain('openstreetmap.org');
	expect(await popup.evaluate(() => window.opener)).toBeNull();
	expect(new URL(page.url()).pathname).toBe('/');
});
