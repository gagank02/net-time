import { error } from '@sveltejs/kit';
import { env } from 'cloudflare:workers';
import type { PageServerLoad } from './$types';

// Test-only: proves unhandled errors never leak details. Enabled only when the E2E_ROUTES var is set
// (Playwright's preview command); production config never sets it, so this is a 404 there.
export const load: PageServerLoad = () => {
	if ((env as { E2E_ROUTES?: string }).E2E_ROUTES !== '1') error(404, 'Not Found');
	throw new Error('SECRET-DETAIL connect ECONNREFUSED 10.0.0.5:5432 user=net_time_app');
};
