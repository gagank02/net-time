import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { checkLimit, ipPrefix, limit } from './ratelimit';

const bindings = env as unknown as Record<string, unknown>;

/** In-memory stand-in for the Workers binding: allows `max` calls per key. */
function fakeLimiter(max: number) {
	const counts = new Map<string, number>();
	return {
		limit: vi.fn(async ({ key }: { key: string }) => {
			const n = (counts.get(key) ?? 0) + 1;
			counts.set(key, n);
			return { success: n <= max };
		})
	};
}

describe('limit', () => {
	beforeEach(() => {
		delete bindings.RL_WRITE;
	});

	it('allows up to the limit, then denies', async () => {
		bindings.RL_WRITE = fakeLimiter(2);
		expect(await limit('write', '1.2.3.4')).toBe(true);
		expect(await limit('write', '1.2.3.4')).toBe(true);
		expect(await limit('write', '1.2.3.4')).toBe(false);
	});

	it('counts keys independently', async () => {
		bindings.RL_WRITE = fakeLimiter(1);
		expect(await limit('write', 'a')).toBe(true);
		expect(await limit('write', 'b')).toBe(true);
	});

	it('fails closed when the binding is missing', async () => {
		expect(await limit('write', 'a')).toBe(false);
	});

	it('fails closed when the binding throws', async () => {
		bindings.RL_WRITE = { limit: vi.fn().mockRejectedValue(new Error('boom')) };
		expect(await limit('write', 'a')).toBe(false);
	});
});

describe('checkLimit', () => {
	beforeEach(() => {
		delete bindings.RL_GLOBAL;
	});

	it('distinguishes limited from unavailable', async () => {
		expect(await checkLimit('global', 'a')).toBe('unavailable');
		bindings.RL_GLOBAL = fakeLimiter(1);
		expect(await checkLimit('global', 'a')).toBe('allowed');
		expect(await checkLimit('global', 'a')).toBe('limited');
		bindings.RL_GLOBAL = { limit: vi.fn().mockRejectedValue(new Error('boom')) };
		expect(await checkLimit('global', 'a')).toBe('unavailable');
	});
});

describe('ipPrefix', () => {
	it('truncates IPv4 to /24 and IPv6 to /48', () => {
		expect(ipPrefix('203.0.113.77')).toBe('203.0.113.0/24');
		expect(ipPrefix('2001:db8:abcd:12:1:2:3:4')).toBe('2001:db8:abcd::/48');
		expect(ipPrefix('garbage')).toBe('unknown');
	});
});
