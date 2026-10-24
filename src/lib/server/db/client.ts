import { env } from 'cloudflare:workers';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema';

export type Db = NodePgDatabase<typeof schema>;

/**
 * Runs `fn` with a per-request DB connection and always closes it.
 * Hyperdrive pools the real connections in prod; locally this talks straight to Postgres
 * as the least-privilege net_time_app role.
 */
export async function withDb<T>(fn: (db: Db) => Promise<T>): Promise<T> {
	const connectionString = env.HYPERDRIVE?.connectionString;
	if (!connectionString) throw new Error('HYPERDRIVE binding missing');

	const client = new pg.Client({ connectionString, connectionTimeoutMillis: 5000 });
	await client.connect();
	try {
		return await fn(drizzle(client, { schema }));
	} finally {
		await client.end().catch(() => {});
	}
}
