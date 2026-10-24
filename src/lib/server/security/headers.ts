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
