import { describe, expect, it } from 'vitest';
import { applySecurityHeaders, securityHeaders } from './headers';

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
