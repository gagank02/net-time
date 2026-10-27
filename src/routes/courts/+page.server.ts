import { chicagoTime } from '#lib/courts/status.js';
import { listCourts } from '#lib/server/courts/data.js';
import type { PageServerLoad } from './$types';

// Built once at deploy from data/*.json; statuses are computed in the browser.
export const prerender = true;

export const load: PageServerLoad = () => listCourts(chicagoTime(new Date()).date);
