// Reviews anonymous corrections, as the owner. Usage: npm run corrections:review
// Production: MIGRATION_DATABASE_URL=<Neon owner URL> npm run corrections:review
//
// - Runs the retention purge first (migration 0005), then walks pending reports oldest first.
// - "Applied" only records the decision: make the real fix in data/*.json with an official
//   source, review it locally, and ship it as usual.
// - Everything a visitor sent is printed through terminalSafe(): no escape sequences, no links.
import { readFile } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import pg from 'pg';
import { CourtsSeed } from './seed-schema.ts';
import { terminalSafe } from './terminal-safe.ts';

const url =
	process.env.MIGRATION_DATABASE_URL ?? 'postgres://net_time_owner@localhost:5432/net_time';

const names = new Map(
	CourtsSeed.parse(JSON.parse(await readFile('data/courts.seed.json', 'utf8'))).locations.map(
		(l) => [l.slug, l.name]
	)
);

type Report = {
	id: string;
	court_slug: string;
	topics: string[];
	details: string;
	seen_on: string | null;
	created_at: Date;
};

const daysAgo = (d: Date) => {
	const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
	return days === 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`;
};

const db = new pg.Client({ connectionString: url });
await db.connect();
const prompt = createInterface({ input: process.stdin });
// Line by line, so it works both typed and piped (question() fails once piped input ends).
const lines = prompt[Symbol.asyncIterator]();
async function ask(question: string): Promise<string> {
	process.stdout.write(question);
	const next = await lines.next();
	if (!process.stdin.isTTY) process.stdout.write('\n');
	return next.done ? 'q' : String(next.value).trim();
}
try {
	await db.query('select purge_old_corrections()');
	const { rows } = await db.query<Report>(
		`select id, court_slug, topics, details, seen_on::text, created_at
		 from corrections where status = 'pending' order by created_at`
	);
	if (rows.length === 0) console.log('No reports waiting.');

	let reviewed = 0;
	for (const [i, r] of rows.entries()) {
		const court = names.get(r.court_slug) ?? r.court_slug;
		console.log(`\n${i + 1} of ${rows.length} · ${terminalSafe(court)} · ${daysAgo(r.created_at)}`);
		console.log(`  Page:          /courts/${terminalSafe(r.court_slug)}`);
		console.log(
			`  What's wrong:  ${r.topics.map((t) => terminalSafe(t).replace('_', ' ')).join(', ')}`
		);
		if (r.seen_on) console.log(`  Seen on:       ${terminalSafe(r.seen_on)}`);
		console.log(`  What's right:  ${terminalSafe(r.details)}`);

		const answer = await ask('  [a]pplied  [r]ejected  [s]kip  [q]uit: ');
		if (answer === 'q') break;
		const status = answer === 'a' ? 'applied' : answer === 'r' ? 'rejected' : null;
		if (!status) continue;
		await db.query(
			`update corrections set status = $1, reviewed_at = now() where id = $2 and status = 'pending'`,
			[status, r.id]
		);
		reviewed++;
		if (status === 'applied') {
			console.log('  Recorded. Now make the fix in data/*.json with an official source.');
		}
	}
	if (rows.length)
		console.log(`\nReviewed ${reviewed}. Reviewed reports are deleted after 30 days.`);
} finally {
	prompt.close();
	await db.end();
}
