import { describe, expect, it } from 'vitest';
import { allowTurnstile, applySecurityHeaders, securityHeaders } from './headers';

describe('applySecurityHeaders', () => {
	it('sets every security header, overriding existing values', () => {
		const res = applySecurityHeaders(
			new Response('x', { headers: { 'referrer-policy': 'unsafe-url' } })
		);
		for (const [name, value] of Object.entries(securityHeaders)) {
			expect(res.headers.get(name)).toBe(value);
		}
	});
});

describe('allowTurnstile', () => {
	it('adds Turnstile to script-src and frame-src only', () => {
		const csp =
			"default-src 'self'; script-src 'self' 'nonce-abc'; frame-src 'none'; connect-src 'self'";
		expect(allowTurnstile(csp)).toBe(
			"default-src 'self'; script-src 'self' 'nonce-abc' https://challenges.cloudflare.com; " +
				"frame-src https://challenges.cloudflare.com; connect-src 'self'"
		);
	});
});
