import { test as base, type Page } from '@playwright/test';

// Each test gets its own client IP (198.18.0.0/15 is reserved for benchmarking), so the global
// rate limit (120 req/min per IP) applies per test, not across the whole suite or back-to-back runs.
// Works only against local wrangler dev; in production Cloudflare overwrites CF-Connecting-IP.
const run = Math.floor(Math.random() * 256);

function ipFor(testId: string): string {
	let h = 0;
	for (const ch of testId) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
	return `198.${18 + (h & 1)}.${run}.${((h >>> 1) % 254) + 1}`;
}

export const test = base.extend({
	extraHTTPHeaders: async ({ extraHTTPHeaders }, use, testInfo) => {
		await use({ ...extraHTTPHeaders, 'cf-connecting-ip': ipFor(testInfo.testId) });
	}
});

export { expect } from '@playwright/test';
export type { Page, Request } from '@playwright/test';

// OpenFreeMap is mocked: the suite never loads a third-party tile server (fair use, no network
// flakiness). The mock tilejson carries OpenFreeMap's real attribution HTML.
const attribution =
	'<a href="https://openfreemap.org" target="_blank">OpenFreeMap</a> <a href="https://www.openmaptiles.org/" target="_blank">&copy; OpenMapTiles</a> Data from <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>';

export async function mockTiles(page: Page) {
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
