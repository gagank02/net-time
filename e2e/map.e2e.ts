import { expect, test, type Page, type Request } from './fixtures';

// OpenFreeMap is mocked: the suite never loads a third-party tile server (fair use, no network
// flakiness). The mock tilejson carries OpenFreeMap's real attribution HTML.
const attribution =
	'<a href="https://openfreemap.org" target="_blank">OpenFreeMap</a> <a href="https://www.openmaptiles.org/" target="_blank">&copy; OpenMapTiles</a> Data from <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>';

async function mockTiles(page: Page) {
	await page.route('https://tiles.openfreemap.org/**', (route) => {
		const url = route.request().url();
		if (url.includes('/styles/'))
			return route.fulfill({
				json: {
					version: 8,
					sources: {
						openmaptiles: { type: 'vector', url: 'https://tiles.openfreemap.org/planet' }
					},
					layers: [
						{ id: 'bg', type: 'background', paint: { 'background-color': '#ddd' } },
						// A layer must use the source for maplibre to show its attribution (as real styles do).
						{ id: 'water', type: 'fill', source: 'openmaptiles', 'source-layer': 'water' }
					]
				}
			});
		if (url.endsWith('/planet'))
			return route.fulfill({
				json: {
					tilejson: '3.0.0',
					tiles: ['https://tiles.openfreemap.org/planet/test/{z}/{x}/{y}.pbf'],
					attribution,
					minzoom: 0,
					maxzoom: 14
				}
			});
		return route.fulfill({ status: 204 });
	});
}

async function openCourts(page: Page, at: string) {
	await mockTiles(page);
	await page.clock.setFixedTime(new Date(at));
	await page.goto(`/courts?at=${encodeURIComponent(at)}`);
	await expect(page.getByRole('button', { name: 'Use my location' })).toBeVisible(); // hydrated
}

const pins = (page: Page) => page.locator('.map .pin');

test('map code and tiles load only after "Show map"', async ({ page }) => {
	const scripts: string[] = [];
	const thirdParty: Request[] = [];
	page.on('request', (r) => r.url().includes('openfreemap') && thirdParty.push(r));
	page.on('response', async (r) => {
		if (r.request().resourceType() !== 'script') return;
		const body = await r.text().catch(() => ''); // the page may close before a body is read
		if (body.includes('maplibregl-canvas')) scripts.push(r.url());
	});

	await openCourts(page, '2026-10-26T10:00:00-05:00');
	await page.waitForLoadState('networkidle');
	expect(scripts).toEqual([]);
	expect(thirdParty).toEqual([]);

	const toggle = page.getByRole('button', { name: 'Show map' });
	await expect(toggle).toHaveAttribute('aria-expanded', 'false');
	await toggle.click();
	await expect(page.getByRole('button', { name: 'Hide map' })).toHaveAttribute(
		'aria-expanded',
		'true'
	);
	await expect(page.getByRole('region', { name: 'Map of courts' })).toBeVisible();
	await expect.poll(() => scripts.length).toBeGreaterThan(0);
	await expect.poll(() => thirdParty.length).toBeGreaterThan(0);
});

test('one labelled pin per listed court, status shown by shape, popup links to the park', async ({
	page
}) => {
	await openCourts(page, '2026-10-26T10:00:00-05:00'); // Monday 10 AM: Maggie Daley has pickleball
	const listed = await page.getByRole('list').getByRole('listitem').count();
	await page.getByRole('button', { name: 'Show map' }).click();
	await expect(pins(page)).toHaveCount(listed);

	// Pins are visual only (the list is the accessible equivalent): hidden from assistive tech.
	await expect(pins(page).first()).toHaveAttribute('aria-hidden', 'true');
	const maggie = page.locator('.pin[data-slug="maggie-daley-park"]');
	await expect(maggie).toHaveClass(/\bclass\b/);
	await expect(maggie).toHaveAttribute('title', /^Maggie Daley Park: Class in progress/);
	await expect(page.locator('.pin[data-slug="oz-park"]')).toHaveClass(/\bopen\b/);

	await maggie.click({ force: true }); // neighbouring pins may overlap at city zoom
	const link = page.locator('.maplibregl-popup').getByRole('link', { name: 'Maggie Daley Park' });
	await expect(link).toHaveAttribute('href', '/courts/maggie-daley-park');
});

test('filters update the pins; attribution links open safely in a new tab; no CSP violations', async ({
	page
}) => {
	const violations: string[] = [];
	await page.addInitScript(() =>
		document.addEventListener('securitypolicyviolation', (e) =>
			console.error(`CSP violation: ${e.violatedDirective} ${e.blockedURI}`)
		)
	);
	page.on('console', (m) => /CSP violation/.test(m.text()) && violations.push(m.text()));

	await openCourts(page, '2026-10-26T10:00:00-05:00');
	await page.getByRole('button', { name: 'Show map' }).click();
	await page.getByRole('checkbox', { name: 'Lights' }).check();
	await expect(page).toHaveURL(/lights=1/);
	await expect(pins(page)).toHaveCount(await page.getByRole('list').getByRole('listitem').count());

	const osm = page.locator('.maplibregl-ctrl-attrib').getByRole('link', { name: 'OpenStreetMap' });
	await expect(osm).toHaveAttribute('target', '_blank');
	await expect(osm).toHaveAttribute('rel', 'noopener noreferrer');

	await page.getByRole('button', { name: 'Hide map' }).click();
	await expect(page.getByRole('region', { name: 'Map of courts' })).toHaveCount(0);
	expect(violations).toEqual([]);
});
