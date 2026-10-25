import { env } from 'cloudflare:workers';
import { chicagoTime } from '#lib/courts/status.js';
import { listCourts } from '#lib/server/courts/queries.js';
import type { PageServerLoad } from './$types';

/** Test-only fixed clock (?at=ISO), honoured only when E2E_ROUTES=1 (never set in production). */
function serverNow(url: URL): Date {
	const at = url.searchParams.get('at');
	if (at && (env as { E2E_ROUTES?: string }).E2E_ROUTES === '1') {
		const d = new Date(at);
		if (!Number.isNaN(d.getTime())) return d;
	}
	return new Date();
}

export const load: PageServerLoad = async ({ url }) => {
	const now = serverNow(url);
	const { courts, areas, zips } = await listCourts(chicagoTime(now).date);
	return { courts, areas, zips, now: now.toISOString() };
};
