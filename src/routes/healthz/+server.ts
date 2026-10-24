import { json } from '@sveltejs/kit';
import { sql } from 'drizzle-orm';
import { withDb } from '#lib/server/db/client.js';
import type { RequestHandler } from './$types';

const headers = { 'cache-control': 'no-store' };

export const GET: RequestHandler = async () => {
	try {
		await withDb((db) => db.execute(sql`select 1`));
		return json({ status: 'ok' }, { headers });
	} catch {
		// No details: error text could reveal hosts, roles or driver internals.
		return json({ status: 'unavailable' }, { status: 503, headers });
	}
};
