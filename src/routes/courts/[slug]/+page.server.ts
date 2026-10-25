import { error } from '@sveltejs/kit';
import { chicagoTime } from '#lib/courts/status.js';
import { requestNow } from '#lib/server/clock.js';
import { getCourt, slugPattern } from '#lib/server/courts/queries.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, url }) => {
	// Reject anything that isn't a well-formed slug before it reaches the database.
	if (!slugPattern.test(params.slug)) error(404, 'Not Found');
	const now = requestNow(url);
	const court = await getCourt(params.slug, chicagoTime(now).date);
	if (!court) error(404, 'Not Found');
	return { court, now: now.toISOString() };
};
