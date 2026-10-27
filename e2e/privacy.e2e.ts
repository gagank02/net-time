import { expect, test } from './fixtures';

test('privacy page is linked from every page footer', async ({ page }) => {
	await page.goto('/courts');
	await page.getByRole('contentinfo').getByRole('link', { name: 'Privacy' }).click();
	await expect(page).toHaveURL(/\/privacy$/);
	await expect(page.getByRole('heading', { level: 1, name: 'Privacy' })).toBeVisible();
});

test('no cookies and no third-party requests while browsing (map not opened)', async ({
	page,
	context,
	baseURL
}) => {
	const origin = new URL(baseURL!).origin;
	const thirdParty: string[] = [];
	page.on('request', (r) => {
		if (new URL(r.url()).origin !== origin) thirdParty.push(r.url());
	});
	for (const path of ['/', '/courts', '/courts/oz-park', '/data', '/privacy']) {
		await page.goto(path);
		await page.waitForLoadState('networkidle');
	}
	expect(thirdParty).toEqual([]);
	expect(await context.cookies()).toEqual([]);
	expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([]);
});
