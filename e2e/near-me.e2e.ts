import { expect, test, type Page, type Request } from './fixtures';

// Distinctive coordinates (near Oz Park) so any leak is unambiguous in request URLs/bodies/headers.
const me = { latitude: 41.919871, longitude: -87.645913 };
const leaks = ['41.9198', '87.6459', '41,9198', '87,6459'];

const names = async (page: Page) =>
	page
		.getByRole('list')
		.getByRole('link')
		.evaluateAll((links) => links.map((a) => a.querySelector('span')?.textContent?.trim() ?? ''));

test('"Use my location" sorts nearest first and the coordinates never leave the browser', async ({
	browser,
	extraHTTPHeaders
}) => {
	const context = await browser.newContext({
		extraHTTPHeaders,
		geolocation: me,
		permissions: ['geolocation']
	});
	const page = await context.newPage();
	const requests: Request[] = [];
	page.on('request', (r) => requests.push(r));

	await page.goto('/courts');
	// Location is only requested on tap, never on page load.
	await page.getByRole('button', { name: 'Use my location' }).click();
	await expect(page.getByText('Nearest to your location')).toBeVisible();
	await expect(page.getByRole('button', { name: 'Using your location' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);

	const [first] = await names(page);
	expect(first).toBe('Oz Park');
	await expect(page.getByRole('list').getByRole('listitem').first()).toContainText(
		/<0\.1 mi|0\.\d mi/
	);

	// Toggling a filter keeps the on-device sort and still sends nothing location-related.
	await page.getByRole('checkbox', { name: 'Lights' }).check();
	await expect(page).toHaveURL(/lights=1/);
	await expect(page.getByText('Nearest to your location')).toBeVisible();
	expect(page.url()).not.toMatch(/lat|lng|41\.9|87\.6/);

	for (const r of requests) {
		const haystack = [r.url(), r.postData() ?? '', JSON.stringify(await r.allHeaders())].join('\n');
		for (const leak of leaks)
			expect(haystack, `request ${r.url()} leaked ${leak}`).not.toContain(leak);
	}
	await context.close();
});

test('blocked location shows help and focuses the neighborhood picker', async ({
	browser,
	extraHTTPHeaders
}) => {
	const context = await browser.newContext({ extraHTTPHeaders, permissions: [] });
	const page = await context.newPage();
	await page.goto('/courts');
	await page.getByRole('button', { name: 'Use my location' }).click();
	await expect(page.getByRole('alert')).toContainText('Pick a neighborhood or enter a ZIP');
	await expect(page.getByLabel('Neighborhood')).toBeFocused();
	await context.close();
});

test('neighborhood sorts nearest first and is shareable via the URL', async ({ page }) => {
	await page.goto('/courts');
	// The auto-submit handler exists only once hydrated; the JS-only button is the signal.
	await expect(page.getByRole('button', { name: 'Use my location' })).toBeVisible();
	await page.getByLabel('Neighborhood').selectOption({ label: 'Loop' });
	await expect(page).toHaveURL(/area=loop/);
	await expect(page.getByText('Nearest to Loop')).toBeVisible();
	const top3 = (await names(page)).slice(0, 3);
	expect(top3.some((n) => /Grant Park|Maggie Daley Park/.test(n))).toBe(true);

	await page.getByRole('button', { name: 'Clear location' }).click();
	await expect(page).not.toHaveURL(/area=/);
	await expect(page.getByText('Nearest to')).toHaveCount(0);
});

test('ZIP works without JavaScript; unknown ZIPs get a helpful message', async ({
	browser,
	extraHTTPHeaders
}) => {
	const context = await browser.newContext({ extraHTTPHeaders, javaScriptEnabled: false });
	const page = await context.newPage();
	await page.goto('/courts');
	await expect(page.getByRole('button', { name: 'Use my location' })).toHaveCount(0); // JS-only
	await page.getByLabel('ZIP').fill('60614');
	await page.getByRole('button', { name: 'Go' }).click();
	await expect(page).toHaveURL(/zip=60614/);
	await expect(page.getByText('Nearest to 60614')).toBeVisible();
	expect((await names(page))[0]).toMatch(/Oz Park|Lincoln Park/);

	await page.goto('/courts?zip=10001');
	await expect(page.getByRole('alert')).toContainText("10001 isn't a Chicago ZIP we know");
	await context.close();
});
