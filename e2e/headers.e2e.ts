import { expect, test } from './fixtures';
import { securityHeaders } from '../src/lib/server/security/headers';

// Prerendered pages and files are served by Cloudflare static assets (headers from /_headers);
// the rest is the Worker (headers from hooks.server.ts).
const workerRoutes = ['/healthz', '/does-not-exist', '/courts/no-such-park'];
const staticRoutes = ['/', '/data', '/privacy', '/courts', '/courts/oz-park', '/robots.txt'];
const staticPages = staticRoutes.filter((p) => p !== '/robots.txt');

const parse = (csp: string) =>
	Object.fromEntries(
		csp
			.split(';')
			.map((d) => d.trim())
			.filter(Boolean)
			.map((d) => {
				const [name, ...values] = d.split(/\s+/);
				return [name, values];
			})
	) as Record<string, string[]>;

function expectSafeScripts(directives: Record<string, string[]>, source: "'nonce-" | "'sha256-") {
	expect(directives['script-src'].some((v) => v.startsWith(source))).toBe(true);
	expect(directives['script-src']).not.toContain("'unsafe-inline'");
	expect(directives['script-src']).not.toContain("'unsafe-eval'");
	expect(directives['default-src']).toEqual(["'self'"]);
	expect(directives['object-src']).toEqual(["'none'"]);
	expect(directives['base-uri']).toEqual(["'self'"]);
	expect(directives['form-action']).toEqual(["'self'"]);
}

for (const path of [...workerRoutes, ...staticRoutes]) {
	test(`security headers on ${path}`, async ({ request }) => {
		const res = await request.get(path);
		const headers = res.headers();
		for (const [name, value] of Object.entries(securityHeaders)) {
			expect(headers[name], name).toBe(value);
		}
	});
}

test('Worker pages: nonce-based CSP header, framing denied', async ({ request }) => {
	const csp = (await request.get('/does-not-exist')).headers()['content-security-policy'];
	const directives = parse(csp);
	expectSafeScripts(directives, "'nonce-");
	expect(directives['frame-ancestors']).toEqual(["'none'"]);
});

test('Worker nonce changes per request', async ({ request }) => {
	const nonce = async () =>
		(await request.get('/does-not-exist'))
			.headers()
			['content-security-policy'].match(/'nonce-([^']+)'/)?.[1];
	expect(await nonce()).not.toBe(await nonce());
});

for (const path of staticPages) {
	test(`static page ${path}: hash-based CSP meta plus framing-denied header`, async ({
		request
	}) => {
		const res = await request.get(path);
		const meta = (await res.text()).match(
			/<meta http-equiv="content-security-policy" content="([^"]+)"/
		)?.[1];
		expect(meta, 'CSP meta tag').toBeTruthy();
		const directives = parse(meta!);
		expectSafeScripts(directives, "'sha256-");
		expect(directives['script-src'].some((v) => v.startsWith("'nonce-"))).toBe(false);

		const header = parse(res.headers()['content-security-policy']);
		expect(header['frame-ancestors']).toEqual(["'none'"]);
		expect(header['object-src']).toEqual(["'none'"]);
	});
}

for (const path of ['/', '/courts', '/courts/maggie-daley-park']) {
	test(`${path} loads with no CSP violations`, async ({ page }) => {
		const violations: string[] = [];
		await page.addInitScript(() => {
			document.addEventListener('securitypolicyviolation', (e) =>
				console.error(`CSP violation: ${e.violatedDirective} ${e.blockedURI}`)
			);
		});
		page.on('console', (msg) => {
			if (/content security policy|CSP violation/i.test(msg.text())) violations.push(msg.text());
		});
		await page.goto(path);
		await page.waitForLoadState('networkidle');
		expect(violations).toEqual([]);
	});
}
