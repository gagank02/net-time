import { sequence } from '@sveltejs/kit/hooks';
import type { Handle, HandleServerError } from '@sveltejs/kit/hooks';
import { describeError, log } from '#lib/server/log.js';
import { applySecurityHeaders } from '#lib/server/security/headers.js';
import { checkLimit, ipPrefix, periodSeconds } from '#lib/server/security/ratelimit.js';
import { parseTheme, themeCookie } from '#lib/theme.js';

const requestContext: Handle = async ({ event, resolve }) => {
	const start = Date.now();
	event.locals.requestId = crypto.randomUUID();
	const response = await resolve(event);
	response.headers.set('x-request-id', event.locals.requestId);
	// route.id is the pattern (e.g. /courts/[id]), so IDs and query strings never reach the logs.
	log('info', 'request', {
		requestId: event.locals.requestId,
		method: event.request.method,
		route: event.route.id,
		status: response.status,
		ms: Date.now() - start
	});
	return response;
};

const securityHeaders: Handle = async ({ event, resolve }) =>
	applySecurityHeaders(await resolve(event));

/** Global per-IP limit before any route code or DB access. Limiter outage → 503 (fail closed). */
export const rateLimit: Handle = async ({ event, resolve }) => {
	let ip = 'unknown';
	try {
		ip = event.getClientAddress() || ip;
	} catch {
		// Shared 'unknown' bucket: still limited, never unlimited.
	}
	const result = await checkLimit('global', ip);
	if (result === 'allowed') return resolve(event);

	log('warn', 'rate_limited', {
		requestId: event.locals.requestId,
		route: event.route.id,
		bucket: 'global',
		reason: result,
		ipPrefix: ipPrefix(ip)
	});
	return result === 'limited'
		? new Response('Too many requests', {
				status: 429,
				headers: { 'retry-after': String(periodSeconds), 'content-type': 'text/plain' }
			})
		: new Response('Service unavailable', {
				status: 503,
				headers: { 'retry-after': '5', 'content-type': 'text/plain' }
			});
};

/** Server-renders the saved appearance onto <html data-theme>, so the first paint is already right. */
const theme: Handle = ({ event, resolve }) => {
	event.locals.theme = parseTheme(event.cookies.get(themeCookie));
	return resolve(event, {
		transformPageChunk: ({ html }) => html.replace('%net.theme%', event.locals.theme)
	});
};

// Order matters: securityHeaders wraps rateLimit so 429/503 responses get headers too.
export const handle = sequence(requestContext, securityHeaders, rateLimit, theme);

/** Unknown errors are logged in full server-side; the client only ever sees a generic message + id. */
export const handleError: HandleServerError = ({ kind, error, event }) => {
	const id = event.locals.requestId ?? crypto.randomUUID();
	if (kind !== 'unknown') return { id };
	log('error', 'unhandled_error', {
		requestId: id,
		route: event.route.id,
		error: describeError(error)
	});
	return { message: 'Something went wrong', id };
};
