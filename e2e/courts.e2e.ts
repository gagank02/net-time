import { expect, test, type Page } from './fixtures';
import { liveClass } from './live-class';

// The page is static; statuses come from the browser clock, pinned here. Runs against the real
// seed data built into the page.
async function openAt(page: Page, iso: string, query = '') {
	await page.clock.setFixedTime(new Date(iso));
	await page.goto(`/courts${query}`);
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

test('a running City class shows as a class and never claims free courts', async ({ page }) => {
	const c = liveClass();
	await openAt(page, c.iso);
	const site = row(page, c.name);
	await expect(site).toContainText('Class in progress');
	await expect(site).toContainText('some courts may be in use until');
});

test('reservation courts say so; closed courts say when they open', async ({ page }) => {
	await openAt(page, '2026-10-26T21:30:00-05:00'); // Monday 9:30 PM
	// McFetridge often has a class or league on; either way the label says booking is needed.
	await expect(row(page, /^McFetridge/)).toContainText('· reservation required');
	await expect(row(page, /^Maggie Daley Park/)).toContainText('Closed');
	await expect(row(page, /^Maggie Daley Park/)).toContainText('opens tomorrow 7 AM');
});

test('seasonal courts say closed for the season; fee courts say so when open', async ({ page }) => {
	await openAt(page, '2026-10-26T13:00:00-05:00');
	const diversey = row(page, /^Diversey Tennis Center/);
	await expect(diversey).toContainText('Closed for the season');
	await expect(diversey).toContainText('open mid-May to mid-October');
	await expect(diversey).not.toContainText('fee to play');
});

test('Open now and Lights filters narrow the list and work via the URL', async ({ page }) => {
	const at = '2026-10-26T21:30:00-05:00';
	await openAt(page, at);
	// Checkbox auto-submit exists only once hydrated; the location button becomes enabled on hydration.
	await expect(page.getByRole('button', { name: 'Use my location' })).toBeEnabled();
	const items = () => page.getByRole('list', { name: 'Courts' }).getByRole('listitem');
	const total = await items().count();

	await page.getByRole('checkbox', { name: 'Open now' }).check();
	await expect(page).toHaveURL(/open=1/);
	await expect(page.getByRole('checkbox', { name: 'Open now' })).toBeChecked();
	await expect(row(page, /^Maggie Daley Park/)).toHaveCount(0);
	await expect(row(page, /^Diversey Tennis Center/)).toHaveCount(0); // closed for the season
	expect(await items().count()).toBe(total - 2);

	await page.getByRole('checkbox', { name: 'Lights' }).check();
	await expect(page).toHaveURL(/open=1.*lights=1|lights=1.*open=1/);
	const lit = await items().count();
	expect(lit).toBeGreaterThan(0);
	expect(lit).toBeLessThan(total);

	await page.getByRole('link', { name: 'Clear filters' }).click();
	await expect(page).toHaveURL(/\/courts$/);

	// A shared filtered link applies once the static page hydrates.
	await page.goto('/courts?open=1');
	await expect(page.getByText(`Showing ${total - 2} of ${total}`)).toBeVisible();
});

test('static HTML never shows a stale status: placeholders until the browser fills them in', async ({
	request
}) => {
	const html = await (await request.get('/courts')).text();
	expect(html).toContain('status pending');
	expect(html).not.toMatch(/class="label[^"]*">(Open now|Class in progress|Closed)/);
});

test('without JavaScript: every court is listed, inert controls are hidden', async ({
	browser,
	extraHTTPHeaders
}) => {
	const context = await browser.newContext({ extraHTTPHeaders, javaScriptEnabled: false });
	const page = await context.newPage();
	await page.goto('/courts?open=1');
	// Playwright's text/role engines skip <noscript> content, so match it by class.
	await expect(page.locator('.nojs')).toContainText(
		'Sorting, filters and live status need JavaScript.'
	);
	expect(
		await page.getByRole('list', { name: 'Courts' }).getByRole('listitem').count()
	).toBeGreaterThan(100);
	await expect(page.getByRole('checkbox', { name: 'Open now' })).toBeHidden();
	await expect(page.getByLabel('ZIP')).toBeHidden();
	await expect(page.getByRole('button', { name: 'Show map' })).toBeHidden();
	await context.close();
});
