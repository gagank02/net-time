import { describe, expect, it, vi } from 'vitest';
import { limit } from './ratelimit';

function platformWith(binding: Partial<RateLimit> | undefined) {
	return { env: { RL_WRITE: binding } } as unknown as App.Platform;
}

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
	it('allows up to the limit, then denies', async () => {
		const platform = platformWith(fakeLimiter(2));
		expect(await limit(platform, 'write', '1.2.3.4')).toBe(true);
		expect(await limit(platform, 'write', '1.2.3.4')).toBe(true);
		expect(await limit(platform, 'write', '1.2.3.4')).toBe(false);
	});

	it('counts keys independently', async () => {
		const platform = platformWith(fakeLimiter(1));
		expect(await limit(platform, 'write', 'a')).toBe(true);
		expect(await limit(platform, 'write', 'b')).toBe(true);
	});

	it('fails closed when the binding is missing', async () => {
		expect(await limit(undefined, 'write', 'a')).toBe(false);
		expect(await limit(platformWith(undefined), 'write', 'a')).toBe(false);
	});

	it('fails closed when the binding throws', async () => {
		const platform = platformWith({ limit: vi.fn().mockRejectedValue(new Error('boom')) });
		expect(await limit(platform, 'write', 'a')).toBe(false);
	});
});
