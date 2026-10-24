const base = 'http://local.invalid';

/**
 * Returns a same-origin path for post-action redirects, or '/' for anything else.
 * Resolving against a dummy origin catches `//evil.com`, `/\evil.com`, `https://evil.com`,
 * and tab/newline tricks that browsers normalise into protocol-relative URLs (open redirect).
 */
export function safeRedirectPath(value: unknown): string {
	if (typeof value !== 'string' || !value.startsWith('/')) return '/';
	try {
		const url = new URL(value, base);
		return url.origin === base ? url.pathname + url.search + url.hash : '/';
	} catch {
		return '/';
	}
}
