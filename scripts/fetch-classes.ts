// Refreshes data/classes.cpd.json from the City of Chicago "Chicago Park District Activities"
// dataset (tn7v-6rnw, City of Chicago Data Terms of Use). Usage: npm run data:classes
//
// - One request per run (SODA API, tennis rows only, no app token needed at this volume), identified
//   by User-Agent. Runs weekly in CI (refresh-data.yml) and opens a PR; nothing fetches at request time.
// - Writes nothing if the response fails validation or the program count drops by more than half
//   (a broken feed must not wipe the schedules); exits non-zero so CI shows it.
import { readFile, writeFile } from 'node:fs/promises';
import { z } from 'zod';
import { transformClasses } from './classes-transform.ts';
import { ClassesCurationSeed, ClassesSeed, CourtsSeed } from './seed-schema.ts';

const url =
	'https://data.cityofchicago.org/resource/tn7v-6rnw.json?' +
	new URLSearchParams({ $where: "category = 'Sports - Tennis'", $limit: '5000' });
const userAgent = 'net-time-data/0.1 (+https://github.com/gagank02/net-time)';
const out = 'data/classes.cpd.json';

const Row = z.object({
	activity_id: z.string(),
	title: z.string(),
	category: z.string(),
	date_notes: z.string(),
	location_facility: z.string(),
	latitude: z.string(),
	longitude: z.string(),
	age_range: z.string().optional(),
	fee: z.string().optional(),
	information_link: z.object({ url: z.string() }).optional(),
	event_cancelled: z.boolean().optional()
});

const readJson = async (path: string) => JSON.parse(await readFile(path, 'utf8'));

const res = await fetch(url, {
	headers: { 'user-agent': userAgent, accept: 'application/json' },
	signal: AbortSignal.timeout(60_000)
});
if (!res.ok) throw new Error(`tn7v-6rnw: HTTP ${res.status}`);
const rows = z.array(Row).parse(await res.json());

const locations = CourtsSeed.parse(await readJson('data/courts.seed.json')).locations;
const { facilities } = ClassesCurationSeed.parse(await readJson('data/classes.curation.json'));
const fetchedAt = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
const { classes, report } = transformClasses(rows, locations, facilities, fetchedAt.slice(0, 10));

const previous = await readJson(out).then(
	(d) => ClassesSeed.parse(d).classes.length,
	() => 0
);
if (classes.length < previous / 2) {
	console.error(`Refusing to write: ${classes.length} programs, down from ${previous}.`);
	process.exit(1);
}

const seed = ClassesSeed.parse({ fetchedAt, classes });
await writeFile(out, JSON.stringify(seed, null, '\t') + '\n');
await writeFile('data/classes.report.md', report);
console.log(report.split('\n')[2]);
