import { expect, test } from './fixtures';

// Locally, wrangler dev passes a client-supplied CF-Connecting-IP through, so each test run uses its
// own fake IP (TEST-NET-3) and its own bucket, leaving other tests unaffected. Cloudflare's edge
// rejects a client-sent CF-Connecting-IP (403, error 1000), so it cannot be spoofed in production.
const limit = 120;
const runIp = () => `203.0.113.${Math.floor(Math.random() * 250) + 1}`;

test('global limit: request N+1 gets 429 with Retry-After; other IPs unaffected', async ({
	request
}) => {
	const ip = runIp();
	const headers = { 'cf-connecting-ip': ip };

	const statuses = await Promise.all(
		Array.from({ length: limit }, () =>
			request.get('/healthz', { headers }).then((r) => r.status())
		)
	);
	expect(statuses.filter((s) => s === 429)).toHaveLength(0);

	const blocked = await request.get('/healthz', { headers });
	expect(blocked.status()).toBe(429);
	expect(blocked.headers()['retry-after']).toBe('60');
	expect(blocked.headers()['x-content-type-options']).toBe('nosniff');

	const otherIp = ip === '198.51.100.1' ? '198.51.100.2' : '198.51.100.1';
	const other = await request.get('/healthz', { headers: { 'cf-connecting-ip': otherIp } });
	expect(other.status()).not.toBe(429);
});
