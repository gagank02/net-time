import { env } from 'cloudflare:workers';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { verifyTurnstile } from './turnstile';

const vars = env as unknown as Record<string, unknown>;

function mockSiteverify(body: unknown, status = 200) {
	return vi
		.spyOn(globalThis, 'fetch')
		.mockResolvedValue(new Response(JSON.stringify(body), { status }));
}

beforeEach(() => {
	vars.TURNSTILE_SECRET = '1x0000000000000000000000000000000AA';
});

afterEach(() => {
	vi.restoreAllMocks();
	delete vars.TURNSTILE_SECRET;
});

describe('verifyTurnstile', () => {
	it('returns true on success and sends secret, token and ip', async () => {
		const fetchSpy = mockSiteverify({ success: true });
		expect(await verifyTurnstile('tok', '203.0.113.5')).toBe(true);
		const [url, init] = fetchSpy.mock.calls[0];
		expect(url).toBe('https://challenges.cloudflare.com/turnstile/v0/siteverify');
		expect(JSON.parse(String(init?.body))).toMatchObject({
			secret: '1x0000000000000000000000000000000AA',
			response: 'tok',
			remoteip: '203.0.113.5'
		});
	});

	it('returns false when Cloudflare says the token is invalid or spent', async () => {
		mockSiteverify({ success: false, 'error-codes': ['timeout-or-duplicate'] });
		expect(await verifyTurnstile('tok', 'ip')).toBe(false);
	});

	it('returns false for missing, empty, non-string or oversized tokens without calling out', async () => {
		const fetchSpy = mockSiteverify({ success: true });
		expect(await verifyTurnstile(null, 'ip')).toBe(false);
		expect(await verifyTurnstile('', 'ip')).toBe(false);
		expect(await verifyTurnstile(new File(['x'], 'f'), 'ip')).toBe(false);
		expect(await verifyTurnstile('x'.repeat(2049), 'ip')).toBe(false);
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it('fails closed on network error or non-200', async () => {
		vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
		expect(await verifyTurnstile('tok', 'ip')).toBe(false);
		vi.restoreAllMocks();
		mockSiteverify({ success: true }, 500);
		expect(await verifyTurnstile('tok', 'ip')).toBe(false);
	});

	it('fails closed when the secret is not configured', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		delete vars.TURNSTILE_SECRET;
		const fetchSpy = mockSiteverify({ success: true });
		expect(await verifyTurnstile('tok', 'ip')).toBe(false);
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it('rejects a token issued for a different action', async () => {
		mockSiteverify({ success: true, action: 'signup' });
		expect(await verifyTurnstile('tok', 'ip', 'report')).toBe(false);
		vi.restoreAllMocks();
		mockSiteverify({ success: true, action: 'report' });
		expect(await verifyTurnstile('tok', 'ip', 'report')).toBe(true);
	});
});
