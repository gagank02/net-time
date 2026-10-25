import { afterEach, describe, expect, it, vi } from 'vitest';
import { cached } from './cache';

function fakeCache() {
	const store = new Map<string, Response>();
	return {
		store,
		match: vi.fn(async (r: Request) => store.get(r.url)?.clone()),
		put: vi.fn(async (r: Request, res: Response) => void store.set(r.url, res))
	};
}

const setCaches = (value: unknown) => ((globalThis as { caches?: unknown }).caches = value);

afterEach(() => setCaches(undefined));

describe('cached', () => {
	it('loads once, then serves the stored JSON with the TTL set', async () => {
		const cache = fakeCache();
		setCaches({ default: cache });
		const load = vi.fn(async () => ({ courts: [1, 2] }));

		expect(await cached('courts/2026-10-25', 3600, load)).toEqual({ courts: [1, 2] });
		await vi.waitFor(() => expect(cache.put).toHaveBeenCalledOnce());
		expect(
			cache.store
				.get('https://cache.net-time.internal/courts/2026-10-25')
				?.headers.get('cache-control')
		).toBe('max-age=3600');

		expect(await cached('courts/2026-10-25', 3600, load)).toEqual({ courts: [1, 2] });
		expect(load).toHaveBeenCalledOnce();
	});

	it('keys by name, so another day misses', async () => {
		setCaches({ default: fakeCache() });
		const load = vi.fn(async () => 'x');
		await cached('courts/2026-10-25', 60, load);
		await cached('courts/2026-10-26', 60, load);
		expect(load).toHaveBeenCalledTimes(2);
	});

	it('caches null (unknown slugs) too', async () => {
		setCaches({ default: fakeCache() });
		const load = vi.fn(async () => null);
		await cached('court/nope/2026-10-25', 60, load);
		await vi.waitFor(async () =>
			expect(await cached('court/nope/2026-10-25', 60, load)).toBeNull()
		);
		expect(load).toHaveBeenCalledOnce();
	});

	it('falls through to the loader without a Cache API or when it fails', async () => {
		expect(await cached('k', 60, async () => 1)).toBe(1);

		setCaches({
			default: {
				match: async () => Promise.reject(new Error('down')),
				put: async () => Promise.reject(new Error('down'))
			}
		});
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		expect(await cached('k', 60, async () => 2)).toBe(2);
		await vi.waitFor(() =>
			expect(warn).toHaveBeenCalledWith(expect.stringContaining('cache_put_failed'))
		);
		warn.mockRestore();
	});
});
