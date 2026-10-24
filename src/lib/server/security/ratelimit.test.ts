import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { limit } from './ratelimit';

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
