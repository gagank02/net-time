import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// Placeholder until C6 (court detail page) replaces it.
export const load: PageServerLoad = () => error(404, 'Not Found');
