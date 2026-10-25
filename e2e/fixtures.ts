import { test as base } from '@playwright/test';

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
