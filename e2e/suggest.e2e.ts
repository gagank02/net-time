import AxeBuilder from '@axe-core/playwright';
import pg from 'pg';
import { expect, tabKey, test, type Page } from './fixtures';

// The correction form against the built Worker and local Postgres, with Cloudflare's Turnstile
// TEST keys (always pass; .dev.vars). Each test has its own client IP (fixtures), so each gets
// its own daily limit. Reports from here start with "E2E" and are deleted afterwards.
const slug = 'waveland-park-tennis-courts';
const form = `/courts/${slug}/suggest`;
const local = !process.env.BASE_URL;
const owner = 'postgres://net_time_owner@localhost:5432/net_time';

async function asOwner<T>(fn: (db: pg.Client) => Promise<T>): Promise<T> {
	const db = new pg.Client({ connectionString: owner });
	await db.connect();
	try {
		return await fn(db);
	} finally {
		await db.end();
	}
}

const stored = (details: string) =>
	asOwner(async (db) => {
		const { rows } = await db.query(
			'SELECT court_slug, topics, details, seen_on::text, status FROM corrections WHERE details = $1',
			[details]
		);
		return rows;
	});

// The fixtures' per-test CF-Connecting-IP header goes on every request; Cloudflare's own servers
// reject it, so it's stripped from Turnstile's requests (script, challenge iframe). Fetched with
// Node's fetch: WebKit re-sends the header on api.js's redirect, and route.fetch re-adds it.
test.beforeEach(async ({ page }) => {
	await page.route('https://challenges.cloudflare.com/**', async (route) => {
		const req = route.request();
		const sent = { ...req.headers() };
		delete sent['cf-connecting-ip'];
		const res = await fetch(req.url(), {
			method: req.method(),
			headers: sent,
			body: req.postData() ?? undefined
		});
		// fetch has already decompressed the body.
		const headers = Object.fromEntries(res.headers);
		delete headers['content-encoding'];
		delete headers['content-length'];
		await route.fulfill({
			status: res.status,
			headers,
			body: Buffer.from(await res.arrayBuffer())
		});
	});
});

test.afterAll(async () => {
	if (local) await asOwner((db) => db.query("DELETE FROM corrections WHERE details LIKE 'E2E%'"));
});

/** Fills the form and waits for Turnstile's token, as a person would wait for the check. */
async function fill(page: Page, details: string, extra: { date?: string; topics?: string[] } = {}) {
	for (const topic of extra.topics ?? ['Hours'])
		await page.getByLabel(topic, { exact: true }).check();
	await page.getByLabel('What’s right').fill(details);
	if (extra.date) await page.getByLabel('Date you were there (optional)').fill(extra.date);
	await expect(page.locator('input[name="cf-turnstile-response"]')).not.toHaveValue('', {
		timeout: 15_000
	});
}

const send = (page: Page) => page.getByRole('button', { name: 'Send correction' }).click();

test('a court page links to its form, which shows what we list now', async ({ page }) => {
	await page.goto(`/courts/${slug}`);
	// Near the top, so a long class list doesn't hide it (and again at the bottom).
	await page
		.locator('header.title')
		.getByRole('link', { name: /Suggest a correction/ })
		.click();
	await expect(page).toHaveURL(new RegExp(`${form}$`));
	await expect(page.getByRole('heading', { level: 1, name: 'Suggest a correction' })).toBeVisible();
	const listing = page.getByRole('region', { name: 'What we list now' });
	await expect(listing.getByText('Courts', { exact: true })).toBeVisible();
	await expect(listing.getByRole('table')).toBeVisible();
	// The honeypot is off-screen and out of the accessibility tree.
	await expect(page.getByRole('textbox', { name: 'Fax' })).toHaveCount(0);
	expect(await page.locator('#company_fax').boundingBox()).toMatchObject({ x: -10000 });
});

test('only the form page allows Turnstile; court pages keep the strict policy', async ({
	request
}) => {
	const csp = (await request.get(form)).headers()['content-security-policy'];
	expect(csp).toMatch(/script-src [^;]*https:\/\/challenges\.cloudflare\.com/);
	expect(csp).toContain('frame-src https://challenges.cloudflare.com');
	const court = await (await request.get(`/courts/${slug}`)).text();
	expect(court).not.toContain('challenges.cloudflare.com');
});

test('unknown courts have no form', async ({ request }) => {
	expect((await request.get('/courts/no-such-court/suggest')).status()).toBe(404);
});

test.describe('sending (local database)', () => {
	test.skip(!local, 'writes to the local database');
	test.skip(({ isMobile }) => isMobile, 'desktop writes; phones render');

	test('a report is stored with only what was sent, then thanks', async ({ page }) => {
		const details = `E2E lights removed ${Date.now()}`;
		await page.goto(form);
		await fill(page, details, {
			topics: ['Hours', 'Lights'],
			date: '2026-10-01'
		});
		await send(page);
		await expect(page).toHaveURL(new RegExp(`${form}\\?sent=1$`));
		await expect(page.getByRole('heading', { name: 'Thanks, we got it' })).toBeVisible();
		expect(await stored(details)).toEqual([
			{
				court_slug: slug,
				topics: ['hours', 'lights'],
				details,
				seen_on: '2026-10-01',
				status: 'pending'
			}
		]);
	});

	test('field errors are listed, linked, and keep what was typed', async ({ page }) => {
		await page.goto(form);
		await fill(page, 'E2E see chicagoparkdistrict.com for hours');
		await send(page);
		const summary = page.getByRole('region', { name: "There's a problem" });
		await expect(summary).toBeFocused();
		await expect(summary.getByRole('link', { name: /What’s right/ })).toBeVisible();
		await expect(page.getByLabel('What’s right')).toHaveValue(
			'E2E see chicagoparkdistrict.com for hours'
		);
		await expect(page.getByLabel('Hours', { exact: true })).toBeChecked();
		await expect(page.getByLabel('Lights', { exact: true })).not.toBeChecked();
	});

	test('offensive language is refused and nothing is stored', async ({ page }) => {
		const details = `E2E these hours are sh1t ${Date.now()}`;
		await page.goto(form);
		await fill(page, details);
		await send(page);
		await expect(page.getByText('Please remove offensive language and try again.')).toHaveCount(2);
		expect(await stored(details)).toEqual([]);
	});

	test('the sixth report from one network in a day is refused', async ({ page }) => {
		test.slow();
		for (let i = 1; i <= 6; i++) {
			await page.goto(form);
			await fill(page, `E2E limit ${i} ${Date.now()}`);
			await send(page);
			if (i <= 5) await expect(page).toHaveURL(/sent=1$/);
		}
		await expect(page.getByText(/most reports we can take from your network today/)).toBeVisible();
	});

	test('a filled honeypot looks accepted but stores nothing', async ({ page }) => {
		const details = `E2E honeypot ${Date.now()}`;
		await page.goto(form);
		await fill(page, details);
		await page.locator('#company_fax').fill('555-0100', { force: true });
		await send(page);
		await expect(page).toHaveURL(/sent=1$/);
		expect(await stored(details)).toEqual([]);
	});

	test('the form can be filled and sent with the keyboard alone', async ({ page, browserName }) => {
		const details = `E2E keyboard ${Date.now()}`;
		await page.goto(form);
		await expect(page.locator('input[name="cf-turnstile-response"]')).not.toHaveValue('', {
			timeout: 15_000
		});
		await page.getByLabel('Hours', { exact: true }).focus();
		await page.keyboard.press('Space');
		await expect(page.getByLabel('Hours', { exact: true })).toBeChecked();
		const right = page.getByLabel('What’s right');
		for (let i = 0; i < 12 && !(await right.evaluate((t) => t === document.activeElement)); i++) {
			await page.keyboard.press(tabKey(browserName));
		}
		await expect(right).toBeFocused();
		await page.keyboard.type(details);
		const send = page.getByRole('button', { name: 'Send correction' });
		for (let i = 0; i < 10 && !(await send.evaluate((b) => b === document.activeElement)); i++) {
			await page.keyboard.press(tabKey(browserName));
		}
		await expect(send).toBeFocused();
		await page.keyboard.press('Enter');
		await expect(page).toHaveURL(/sent=1$/);
		expect(await stored(details)).toHaveLength(1);
	});

	test('SQL injection in the form is stored as plain text and runs nothing', async ({ page }) => {
		const details = `E2E x'); DROP TABLE corrections; -- ' OR '1'='1 ${Date.now()}`;
		await page.goto(form);
		await fill(page, details);
		await send(page);
		await expect(page).toHaveURL(/sent=1$/);
		expect(await stored(details)).toEqual([expect.objectContaining({ details })]);
		const tables = await asOwner((db) =>
			db.query("SELECT count(*)::int AS n FROM corrections WHERE details LIKE 'E2E%'")
		);
		expect(tables.rows[0].n).toBeGreaterThanOrEqual(1);
	});

	test('a cross-site post is refused before any route code', async ({ request }) => {
		const res = await request.post(form, {
			headers: { origin: 'https://evil.example' },
			form: { topics: 'hours', details: 'E2E cross-site' }
		});
		expect(res.status()).toBe(403);
		expect(await stored('E2E cross-site')).toEqual([]);
	});
});

for (const scheme of ['light', 'dark'] as const) {
	test(`axe: correction form has no violations (${scheme})`, async ({ page }) => {
		await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
		await page.goto(form);
		// Cloudflare's widget is a cross-origin iframe we don't control.
		const { violations } = await new AxeBuilder({ page })
			.withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
			.exclude('.turnstile')
			.analyze();
		expect(violations.map((v) => `${v.impact} ${v.id}: ${v.nodes.map((n) => n.target)}`)).toEqual(
			[]
		);
	});
}

test('/privacy explains corrections and Turnstile; /data points to the form', async ({ page }) => {
	await page.goto('/privacy');
	await expect(page.getByRole('heading', { name: 'Corrections you send' })).toBeVisible();
	await expect(page.getByText(/We never store your IP address/)).toBeVisible();
	await expect(page.getByRole('link', { name: /Turnstile privacy addendum/ })).toHaveAttribute(
		'href',
		'https://www.cloudflare.com/turnstile-privacy-policy/'
	);
	await page.goto('/data');
	await expect(page.getByText(/Suggest a correction/)).toBeVisible();
	await page.getByRole('link', { name: 'Find a court' }).click();
	await expect(page).toHaveURL(/\/courts$/);
});
