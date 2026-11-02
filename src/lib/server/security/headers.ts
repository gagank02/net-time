// Non-CSP security headers for every Worker response. CSP is configured via `csp` in vite.config.ts.
// Static assets get the same set from /_headers; e2e/headers.e2e.ts checks both stay in sync.
export const securityHeaders: Record<string, string> = {
	'strict-transport-security': 'max-age=63072000; includeSubDomains; preload',
	'x-content-type-options': 'nosniff',
	'referrer-policy': 'strict-origin-when-cross-origin',
	'permissions-policy': 'geolocation=(self), camera=(), microphone=(), payment=()',
	'cross-origin-opener-policy': 'same-origin'
};

export function applySecurityHeaders(response: Response): Response {
	for (const [name, value] of Object.entries(securityHeaders)) response.headers.set(name, value);
	return response;
}

/** Cloudflare Turnstile's origin: its script and challenge iframe both load from here. */
export const turnstileOrigin = 'https://challenges.cloudflare.com';

/**
 * Allows Turnstile in a page's CSP: adds its origin to script-src and makes it the only frame-src.
 * Called for the correction form only, so every other page keeps the strict policy (and loads
 * nothing third-party). Leaves the policy alone if a directive is missing, rather than guessing.
 */
export function allowTurnstile(csp: string): string {
	return csp
		.split(';')
		.map((d) => d.trim())
		.map((d) => {
			if (d.startsWith('script-src ')) return `${d} ${turnstileOrigin}`;
			if (d.startsWith('frame-src ')) return `frame-src ${turnstileOrigin}`;
			return d;
		})
		.join('; ');
}
