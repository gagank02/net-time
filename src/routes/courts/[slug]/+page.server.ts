import { error } from '@sveltejs/kit';
import { chicagoTime } from '#lib/courts/status.js';
import { courtSlugs, getCourt } from '#lib/server/courts/data.js';
import type { EntryGenerator, PageServerLoad } from './$types';

// One static page per seeded court; any other slug falls through to the Worker's 404.
export const prerender = true;

export const entries: EntryGenerator = () => courtSlugs.map((slug) => ({ slug }));

export const load: PageServerLoad = ({ params }) => {
	const builtAt = new Date();
	const court = getCourt(params.slug, chicagoTime(builtAt).date);
	if (!court) error(404, 'Not Found');
	return { court, builtAt: builtAt.toISOString() };
};
