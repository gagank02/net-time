import { count, eq, sql } from 'drizzle-orm';
import { withDb } from './client';
import { correctionLimits, correctionNotices, corrections } from './schema';

/** Per network per Chicago day (SPEC-submissions, "Rate limits"). */
export const dailyLimit = 5;
/** Pending reports at which new ones are refused, so storage and review time stay bounded. */
export const pendingCap = 200;

export type StoreResult =
	| { result: 'stored'; pending: number; notify: boolean }
	| { result: 'duplicate' | 'rate_limited' | 'queue_full' };

/** At most one owner notification per this many minutes, however many reports arrive. */
export const notifyEveryMinutes = 60;

type NewCorrection = {
	courtSlug: string;
	topics: (typeof corrections.$inferInsert)['topics'];
	details: string;
	seenOn?: string;
	dedupeKey: string;
};

/**
 * Stores one report as the app role, which can only insert reports and read `status` and
 * `dedupe_key` (migration 0005). Never uses RETURNING on reports: the role can't read them back.
 * ponytail: steps aren't one transaction, so two racing requests can overshoot a limit by one;
 * fine for a 5/day and 200-pending guard, wrap in a transaction if the limits ever get tight.
 */
export function storeCorrection(
	report: NewCorrection,
	rateKey: string,
	day: string
): Promise<StoreResult> {
	return withDb(async (db) => {
		// Retention (migration 0005): drops expired reports and rate-limit codes, as the owner.
		await db.execute(sql`select purge_old_corrections()`);

		const [{ pending }] = await db
			.select({ pending: count() })
			.from(corrections)
			.where(eq(corrections.status, 'pending'));
		if (pending >= pendingCap) return { result: 'queue_full' };

		const [limit] = await db
			.insert(correctionLimits)
			.values({ key: rateKey, day })
			.onConflictDoUpdate({
				target: correctionLimits.key,
				set: { count: sql`${correctionLimits.count} + 1` }
			})
			.returning({ count: correctionLimits.count });
		if (limit.count > dailyLimit) return { result: 'rate_limited' };

		// Plain SQL on purpose: Drizzle's insert names every column (id, status...) with DEFAULT, and
		// the app role may only insert the visitor's fields. Values are still bound parameters; topics
		// goes through sql.param as one array value (a bare array would expand into a list).
		const inserted = await db.execute(sql`
			insert into ${corrections} (court_slug, topics, details, seen_on, dedupe_key)
			values (${report.courtSlug}, ${sql.param(report.topics)}::text[], ${report.details}, ${report.seenOn ?? null}, ${report.dedupeKey})
			on conflict (dedupe_key) do nothing`);
		if (inserted.rowCount !== 1) return { result: 'duplicate' };

		// Claims the hourly notification slot atomically: only one request in the hour gets a row back.
		const claimed = await db
			.update(correctionNotices)
			.set({ sentAt: sql`now()` })
			.where(
				sql`${correctionNotices.id} = 1 and ${correctionNotices.sentAt} < now() - make_interval(mins => ${notifyEveryMinutes})`
			)
			.returning({ id: correctionNotices.id });
		return { result: 'stored', pending: pending + 1, notify: claimed.length === 1 };
	});
}
