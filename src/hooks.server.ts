import { sequence } from '@sveltejs/kit/hooks';
import type { Handle, HandleServerError } from '@sveltejs/kit/hooks';
import { describeError, log } from '#lib/server/log.js';
import { applySecurityHeaders } from '#lib/server/security/headers.js';

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

export const handle = sequence(requestContext, securityHeaders);

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
