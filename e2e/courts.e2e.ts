import { expect, test, type Page } from './fixtures';

// Server clock via ?at= (honoured only with E2E_ROUTES=1); browser clock pinned to the same instant
// so the client-side status refresh agrees. Runs against the real seeded local data.
async function openAt(page: Page, iso: string, query = '') {
	await page.clock.setFixedTime(new Date(iso));
	await page.goto(`/courts?at=${encodeURIComponent(iso)}${query}`);
}

const row = (page: Page, name: string | RegExp) =>
	page.getByRole('listitem').filter({ has: page.getByRole('link', { name }) });

test('lists every seeded location with a status', async ({ page }) => {
	await openAt(page, '2026-10-26T13:00:00-05:00');
	await expect(page.getByRole('heading', { level: 1, name: 'Courts' })).toBeVisible();
	const count = await page.getByRole('list', { name: 'Courts' }).getByRole('listitem').count();
	expect(count).toBeGreaterThan(100);
	await expect(page.getByText(`Showing all ${count}`)).toBeVisible();
	await expect(row(page, /^Oz Park/)).toContainText('Open now');
});

test('class blocks show their own title and courts free', async ({ page }) => {
	await openAt(page, '2026-10-26T10:00:00-05:00'); // Monday 10 AM
	const maggie = row(page, /^Maggie Daley Park/);
	await expect(maggie).toContainText('Pickleball open play (courts 1–5)');
	await expect(maggie).toContainText('1 of 6 courts free until Noon');
});

test('reservation courts say so; closed courts say when they open', async ({ page }) => {
	await openAt(page, '2026-10-26T21:30:00-05:00'); // Monday 9:30 PM
	await expect(row(page, /^McFetridge/)).toContainText('Open now · reservation required');
	await expect(row(page, /^Maggie Daley Park/)).toContainText('Closed');
	await expect(row(page, /^Maggie Daley Park/)).toContainText('opens tomorrow 7 AM');
});

test('Open now and Lights filters narrow the list and work via the URL', async ({ page }) => {
	const at = '2026-10-26T21:30:00-05:00';
	await openAt(page, at);
	// Checkbox auto-submit exists only once hydrated; the location button becomes enabled on hydration.
	await expect(page.getByRole('button', { name: 'Use my location' })).toBeEnabled();
	const items = () => page.getByRole('list', { name: 'Courts' }).getByRole('listitem');
	const total = await items().count();

	// Toggling submits the GET form (no ?at=), so re-apply the test clock to the resulting URL.
	const keepClock = async () => {
		const url = new URL(page.url());
		url.searchParams.set('at', at);
		await page.goto(url.pathname + url.search);
	};

	await page.getByRole('checkbox', { name: 'Open now' }).check();
	await expect(page).toHaveURL(/open=1/);
	await keepClock();
	await expect(page.getByRole('button', { name: 'Use my location' })).toBeEnabled();
	await expect(page.getByRole('checkbox', { name: 'Open now' })).toBeChecked();
	await expect(row(page, /^Maggie Daley Park/)).toHaveCount(0);
	expect(await items().count()).toBe(total - 1);

	await page.getByRole('checkbox', { name: 'Lights' }).check();
	await expect(page).toHaveURL(/open=1.*lights=1|lights=1.*open=1/);
	await keepClock();
	const lit = await items().count();
	expect(lit).toBeGreaterThan(0);
	expect(lit).toBeLessThan(total);

	await page.getByRole('link', { name: 'Clear filters' }).click();
	await expect(page).toHaveURL(/\/courts$/);
});

test('filters work without JavaScript', async ({ browser, extraHTTPHeaders }) => {
	const context = await browser.newContext({ extraHTTPHeaders, javaScriptEnabled: false });
	const page = await context.newPage();
	await page.goto('/courts?at=2026-10-26T23:30:00-05:00&open=1');
	await expect(page.getByText('No courts match')).toBeVisible();
	await context.close();
});
