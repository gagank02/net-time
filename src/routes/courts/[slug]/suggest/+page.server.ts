import { env } from 'cloudflare:workers';
import { error, fail, redirect } from '@sveltejs/kit';
import { addDays, chicagoTime } from '#lib/courts/status.js';
import { submitCorrection } from '#lib/server/corrections/submit.js';
import { courtSlugs, getCourt } from '#lib/server/courts/data.js';
import type { Actions, PageServerLoad } from './$types';

// Rendered by the Worker, not prerendered: only this page's CSP allows Turnstile (hooks.server.ts),
// and a prerendered page's <meta> CSP can't be widened per path.
export const prerender = false;

const courts = new Set(courtSlugs);

/** What the visitor sees for each refusal. Never echoes what they typed. */
const messages = {
	bad_request: 'Something went wrong sending that. Please reload the page and try again.',
	turnstile_failed: 'We couldn’t confirm you’re a person. Wait for the check to finish, then send.',
	rate_limited: 'That’s the most reports we can take from your network today. Thanks for the help.',
	queue_full: 'We’re catching up on reports. Please try again in a few days.',
	unavailable: 'Reports aren’t working right now. Please try again later.'
} as const;

const statuses = {
	bad_request: 400,
	turnstile_failed: 403,
	rate_limited: 429,
	queue_full: 503,
	unavailable: 503
} as const;

export const load: PageServerLoad = ({ params, url }) => {
	const now = new Date();
	const today = chicagoTime(now).date;
	const court = getCourt(params.slug, today);
	if (!court) error(404, 'Not Found');
	return {
		court,
		today,
		yearAgo: addDays(today, -365),
		builtAt: now.toISOString(),
		sent: url.searchParams.get('sent') === '1',
		siteKey: env.TURNSTILE_SITE_KEY ?? null
	};
};

export const actions: Actions = {
	default: async ({ request, params, getClientAddress, locals, platform }) => {
		let ip = 'unknown';
		try {
			ip = getClientAddress() || ip;
		} catch {
			// Shared 'unknown' key: still limited, never unlimited.
		}
		const result = await submitCorrection(request, {
			court: params.slug,
			ip,
			courts,
			now: new Date(),
			requestId: locals.requestId,
			waitUntil: platform?.ctx.waitUntil.bind(platform.ctx)
		});
		// Post/redirect/get: reloading the thank-you page can't send the report twice.
		if (result.outcome === 'ok') redirect(303, `/courts/${params.slug}/suggest?sent=1`);
		if (result.outcome === 'invalid') {
			return fail(400, { errors: result.errors, values: result.values });
		}
		return fail(statuses[result.outcome], { errors: { _form: messages[result.outcome] } });
	}
};
