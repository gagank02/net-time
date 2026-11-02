import { expect, test } from '@playwright/test';
import pg from 'pg';

// The corrections table is the first place the public can write. Even a fully compromised Worker
// (which connects as net_time_app) must not be able to read report text, mark reports reviewed,
// or delete them. Runs against the local or CI database after migrations; everything rolls back.
test.skip(!!process.env.BASE_URL, 'local database only');

const appRole = 'postgres://net_time_app:local@localhost:5432/net_time';
const report = `INSERT INTO corrections (court_slug, topics, details, dedupe_key)
	VALUES ('test-court', ARRAY['hours'], 'Closes at 9 PM now', $1) ON CONFLICT (dedupe_key) DO NOTHING`;

let db: pg.Client;

test.beforeEach(async () => {
	db = new pg.Client({ connectionString: appRole });
	await db.connect();
	await db.query('BEGIN');
});

test.afterEach(async () => {
	await db.query('ROLLBACK');
	await db.end();
});

/** Runs `sql` inside a savepoint so a refused statement doesn't abort the test's transaction. */
async function attempt(sql: string, params: unknown[] = []) {
	await db.query('SAVEPOINT attempt');
	try {
		await db.query(sql, params);
		return 'allowed';
	} catch (e) {
		return (e as { code?: string }).code === '42501' ? 'denied' : String(e);
	} finally {
		await db.query('ROLLBACK TO SAVEPOINT attempt');
	}
}

test('the app can add a report, drop a same-day repeat, and count pending', async () => {
	expect((await db.query(report, ['k1'])).rowCount).toBe(1);
	expect((await db.query(report, ['k1'])).rowCount).toBe(0);
	const { rows } = await db.query(
		"SELECT count(*)::int AS n FROM corrections WHERE status = 'pending'"
	);
	expect(rows[0].n).toBeGreaterThanOrEqual(1);
});

test('the purge removes only reports past retention, and the app can run it', async () => {
	const owner = new pg.Client({
		connectionString: 'postgres://net_time_owner@localhost:5432/net_time'
	});
	await owner.connect();
	try {
		await owner.query('BEGIN');
		await owner.query(`INSERT INTO corrections (court_slug, topics, details, dedupe_key, status, created_at, reviewed_at) VALUES
			('t', ARRAY['hours'], 'E2E new', 'p1', 'pending', now(), null),
			('t', ARRAY['hours'], 'E2E old pending', 'p2', 'pending', now() - interval '181 days', null),
			('t', ARRAY['hours'], 'E2E reviewed recently', 'p3', 'rejected', now() - interval '40 days', now() - interval '29 days'),
			('t', ARRAY['hours'], 'E2E reviewed long ago', 'p4', 'applied', now() - interval '60 days', now() - interval '31 days')`);
		await owner.query('SELECT purge_old_corrections()');
		const { rows } = await owner.query(
			"SELECT details FROM corrections WHERE details LIKE 'E2E%' ORDER BY details"
		);
		expect(rows.map((r) => r.details)).toEqual(['E2E new', 'E2E reviewed recently']);
	} finally {
		await owner.query('ROLLBACK');
		await owner.end();
	}
});

test('the app can keep the per-network counter', async () => {
	expect(
		await attempt(
			`INSERT INTO correction_limits (key, day) VALUES ('k', current_date)
			ON CONFLICT (key) DO UPDATE SET count = correction_limits.count + 1 RETURNING count`
		)
	).toBe('allowed');
	expect(await attempt('SELECT purge_old_corrections()')).toBe('allowed');
	expect(await attempt('DELETE FROM correction_limits')).toBe('denied');
});

test('the app can claim the hourly notice once, and nothing more', async () => {
	await db.query("UPDATE correction_notices SET sent_at = 'epoch'").catch(() => {});
	const claim = `UPDATE correction_notices SET sent_at = now()
		WHERE id = 1 AND sent_at < now() - interval '60 minutes' RETURNING id`;
	expect((await db.query(claim)).rowCount).toBe(1);
	expect((await db.query(claim)).rowCount).toBe(0);
	expect(await attempt('UPDATE correction_notices SET id = 2')).toBe('denied');
	expect(await attempt('DELETE FROM correction_notices')).toBe('denied');
	expect(await attempt('INSERT INTO correction_notices VALUES (1, now())')).toBe('denied');
});

for (const [what, sql] of [
	['read report text', 'SELECT details FROM corrections'],
	['read anything with RETURNING', `${report} RETURNING id`],
	[
		'set a status on insert',
		`INSERT INTO corrections (court_slug, topics, details, dedupe_key, status)
		VALUES ('test-court', ARRAY['hours'], 'x', $1, 'applied')`
	],
	['mark reports reviewed', "UPDATE corrections SET status = 'rejected', reviewed_at = now()"],
	['delete reports', 'DELETE FROM corrections'],
	['empty the table', 'TRUNCATE corrections'],
	['change court data', "UPDATE court_locations SET name = 'x'"]
] as const) {
	test(`the app cannot ${what}`, async () => {
		const params = sql.includes('$1') ? ['k2'] : [];
		expect(await attempt(sql, params)).toBe('denied');
	});
}
