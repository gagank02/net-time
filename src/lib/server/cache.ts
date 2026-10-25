import { waitUntil } from 'cloudflare:workers';
import { describeError, log } from '#lib/server/log.js';

// Never routed: the Cache API only needs a URL-shaped key, and nothing serves this host.
const keyOrigin = 'https://cache.net-time.internal';

/**
 * Read-through cache for public, non-personal data (court listings) in this Cloudflare data
 * center, so most page views never reach Hyperdrive or wake Neon. Only data goes in, never
 * HTML: pages carry a per-request CSP nonce and the visitor's theme.
 * Falls through to `load` wherever the Cache API is missing or fails (vite dev, tests, outages).
 */
export async function cached<T>(
	key: string,
	ttlSeconds: number,
	load: () => Promise<T>
): Promise<T> {
	const cache = (globalThis as { caches?: { default?: Cache } }).caches?.default;
	const request = new Request(`${keyOrigin}/${key}`);
	const hit = await cache?.match(request).catch(() => undefined);
	if (hit) return (await hit.json()) as T;

	const value = await load();
	if (cache) {
		const response = new Response(JSON.stringify(value), {
			headers: { 'content-type': 'application/json', 'cache-control': `max-age=${ttlSeconds}` }
		});
		waitUntil(
			cache
				.put(request, response)
				.catch((e) => log('warn', 'cache_put_failed', { error: describeError(e) }))
		);
	}
	return value;
}
