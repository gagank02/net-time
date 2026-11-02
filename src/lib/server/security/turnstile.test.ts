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
	it('returns true on success and sends secret and token, never the IP', async () => {
		const fetchSpy = mockSiteverify({ success: true });
		expect(await verifyTurnstile('tok')).toBe(true);
		const [url, init] = fetchSpy.mock.calls[0];
		expect(url).toBe('https://challenges.cloudflare.com/turnstile/v0/siteverify');
		const body = JSON.parse(String(init?.body));
		expect(body).toMatchObject({ secret: '1x0000000000000000000000000000000AA', response: 'tok' });
		expect(body).not.toHaveProperty('remoteip');
	});

	it('returns false when Cloudflare says the token is invalid or spent', async () => {
		mockSiteverify({ success: false, 'error-codes': ['timeout-or-duplicate'] });
		expect(await verifyTurnstile('tok')).toBe(false);
	});

	it('returns false for missing, empty, non-string or oversized tokens without calling out', async () => {
		const fetchSpy = mockSiteverify({ success: true });
		expect(await verifyTurnstile(null)).toBe(false);
		expect(await verifyTurnstile('')).toBe(false);
		expect(await verifyTurnstile(new File(['x'], 'f'))).toBe(false);
		expect(await verifyTurnstile('x'.repeat(2049))).toBe(false);
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it('fails closed on network error or non-200', async () => {
		vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
		expect(await verifyTurnstile('tok')).toBe(false);
		vi.restoreAllMocks();
		mockSiteverify({ success: true }, 500);
		expect(await verifyTurnstile('tok')).toBe(false);
	});

	it('fails closed when the secret is not configured', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		delete vars.TURNSTILE_SECRET;
		const fetchSpy = mockSiteverify({ success: true });
		expect(await verifyTurnstile('tok')).toBe(false);
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it('rejects a token issued for a different action', async () => {
		mockSiteverify({ success: true, action: 'signup' });
		expect(await verifyTurnstile('tok', 'report')).toBe(false);
		vi.restoreAllMocks();
		mockSiteverify({ success: true, action: 'report' });
		expect(await verifyTurnstile('tok', 'report')).toBe(true);
	});

	it('rejects a token solved on another hostname', async () => {
		mockSiteverify({ success: true, action: 'correction', hostname: 'evil.example' });
		expect(await verifyTurnstile('tok', 'correction', 'net-time.example')).toBe(false);
		vi.restoreAllMocks();
		mockSiteverify({ success: true, action: 'correction', hostname: 'net-time.example' });
		expect(await verifyTurnstile('tok', 'correction', 'net-time.example')).toBe(true);
	});

	it('accepts Cloudflare test-key results, which carry no action or our hostname', async () => {
		mockSiteverify({
			success: true,
			hostname: 'example.com',
			metadata: { result_with_testing_key: true }
		});
		expect(await verifyTurnstile('tok', 'correction', 'net-time.example')).toBe(true);
	});
});
