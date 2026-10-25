import { chicagoTime } from '#lib/courts/status.js';
import { requestNow } from '#lib/server/clock.js';
import { listCourts } from '#lib/server/courts/queries.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const now = requestNow(url);
	const { courts, areas, zips } = await listCourts(chicagoTime(now).date);
	return { courts, areas, zips, now: now.toISOString() };
};
