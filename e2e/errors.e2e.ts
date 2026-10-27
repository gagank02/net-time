import { expect, test } from './fixtures';

test('unhandled error shows a generic page with a reference id and no internals', async ({
	page
}) => {
	// /__e2e/* routes exist only in local preview builds (E2E_ROUTES).
	test.skip(!!process.env.BASE_URL, 'needs the local-only test routes');
	const res = await page.goto('/__e2e/throw');
	expect(res?.status()).toBe(500);

	const requestId = res?.headers()['x-request-id'];
	expect(requestId).toMatch(/^[0-9a-f-]{36}$/);

	const body = await res!.text();
	for (const leak of [
		'SECRET-DETAIL',
		'ECONNREFUSED',
		'10.0.0.5',
		'net_time_app',
		' at ',
		'.ts:'
	]) {
		expect(body, `leaked "${leak}"`).not.toContain(leak);
	}
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Something went wrong');
	await expect(page.getByText(requestId!)).toBeVisible();
});

test('404 page shows not found with a reference id', async ({ page }) => {
	const res = await page.goto('/no-such-page');
	expect(res?.status()).toBe(404);
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Page not found');
	await expect(page.getByText(res!.headers()['x-request-id'])).toBeVisible();
});
