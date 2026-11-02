import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';
import { describe, expect, it, vi } from 'vitest';
import { withDb } from './client';
import { storeCorrection } from './corrections';

vi.mock('./client', () => ({ withDb: vi.fn() }));

const attacks = [
	"x'); DROP TABLE corrections; --",
	"' OR '1'='1",
	"hours'::text[]); DELETE FROM correction_limits; --",
	"$1 $$ \\x00 E'\\\\'"
];

/** Runs storeCorrection against a fake db and returns the report insert as Postgres would get it. */
async function insertFor(details: string, topics = ['hours'] as ['hours']) {
	const execute = vi.fn().mockResolvedValue({ rowCount: 1 });
	const chain = {
		where: () => chain,
		from: () => chain,
		values: () => chain,
		set: () => chain,
		onConflictDoUpdate: () => chain,
		returning: () => Promise.resolve([{ count: 1 }]),
		then: (f: (v: unknown) => unknown) => Promise.resolve([{ pending: 0 }]).then(f)
	};
	const db = { select: () => chain, insert: () => chain, update: () => chain, execute };
	vi.mocked(withDb).mockImplementation((fn) => fn(db as never));
	await storeCorrection(
		{ courtSlug: 'waveland', topics, details, dedupeKey: 'k' },
		'rate',
		'2026-10-27'
	);
	const query = new PgDialect().sqlToQuery(execute.mock.calls.at(-1)![0] as SQL);
	return { ...query, sql: query.sql.replace(/\s+/g, ' ').trim() };
}

describe('storeCorrection SQL injection', () => {
	it.each(attacks)('sends %j only as a bound parameter, never in the SQL text', async (attack) => {
		const { sql, params } = await insertFor(attack);
		expect(sql).toMatch(/values \(\$1, \$2::text\[\], \$3, \$4, \$5\)/);
		expect(sql).not.toContain(attack);
		expect(sql).not.toMatch(/drop|delete|' or/i);
		expect(params).toEqual(['waveland', ['hours'], attack, null, 'k']);
	});

	it('binds the topics list as one array parameter', async () => {
		const { params } = await insertFor('ok', ['hours', 'lights'] as never);
		expect(params[1]).toEqual(['hours', 'lights']);
	});
});
