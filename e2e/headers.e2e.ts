import { expect, test } from './fixtures';
import { securityHeaders } from '../src/lib/server/security/headers';

const workerRoutes = ['/', '/healthz', '/does-not-exist'];
const staticRoutes = ['/robots.txt'];

for (const path of [...workerRoutes, ...staticRoutes]) {
	test(`security headers on ${path}`, async ({ request }) => {
		const res = await request.get(path);
		const headers = res.headers();
		for (const [name, value] of Object.entries(securityHeaders)) {
			expect(headers[name], name).toBe(value);
		}
	});
}

test('page CSP: nonce-based script-src, no unsafe script sources, framing denied', async ({
	request
}) => {
	const csp = (await request.get('/')).headers()['content-security-policy'];
	expect(csp).toBeTruthy();
	const directives = Object.fromEntries(
		csp.split(';').map((d) => {
			const [name, ...values] = d.trim().split(/\s+/);
			return [name, values];
		})
	);
	expect(directives['script-src'].some((v: string) => v.startsWith("'nonce-"))).toBe(true);
	expect(directives['script-src']).not.toContain("'unsafe-inline'");
	expect(directives['script-src']).not.toContain("'unsafe-eval'");
	expect(directives['default-src']).toEqual(["'self'"]);
	expect(directives['object-src']).toEqual(["'none'"]);
	expect(directives['frame-ancestors']).toEqual(["'none'"]);
	expect(directives['base-uri']).toEqual(["'self'"]);
	expect(directives['form-action']).toEqual(["'self'"]);
});

test('nonce changes per request', async ({ request }) => {
	const nonce = async () =>
		(await request.get('/')).headers()['content-security-policy'].match(/'nonce-([^']+)'/)?.[1];
	expect(await nonce()).not.toBe(await nonce());
});

test('home page loads with no CSP violations', async ({ page }) => {
	const violations: string[] = [];
	await page.addInitScript(() => {
		document.addEventListener('securitypolicyviolation', (e) =>
			console.error(`CSP violation: ${e.violatedDirective} ${e.blockedURI}`)
		);
	});
	page.on('console', (msg) => {
		if (/content security policy|CSP violation/i.test(msg.text())) violations.push(msg.text());
	});
	await page.goto('/');
	await page.waitForLoadState('networkidle');
	expect(violations).toEqual([]);
});
