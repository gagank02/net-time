// Pure transform: City of Chicago "Chicago Park District Activities" rows (tn7v-6rnw) → class
// blocks keyed to our court locations, plus a report. No network; fetch-classes.ts calls this.
import { distanceMeters, type LatLng } from '../src/lib/geo.ts';
import { everydayName } from './courts-transform.ts';

/** The fields we read from a dataset row; everything else (e.g. the long description) is ignored. */
export type ActivityRow = {
	activity_id: string;
	title: string;
	category: string;
	date_notes: string;
	location_facility: string;
	latitude: string;
	longitude: string;
	age_range?: string;
	fee?: string;
	information_link?: { url: string };
	event_cancelled?: boolean;
};

export type Schedule = {
	weekdays: number[]; // 0 = Sunday
	starts: string; // HH:MM, Chicago wall clock
	ends: string; // HH:MM; "24:00" when a class runs to midnight
	seasonStart: string; // YYYY-MM-DD
	seasonEnd: string;
	except: string[];
};

export type Location = LatLng & { slug: string; name: string };

/** A park's programs count only within this distance of one of our court locations. */
export const matchMeters = 600;

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** "September 16, 2026" or "Sep 16, 2026" → "2026-09-16". */
function isoDate(text: string): string | null {
	const m = /^([A-Z][a-z]+) (\d{1,2}), (\d{4})$/.exec(text.trim());
	const month = m ? months.indexOf(m[1].slice(0, 3)) : -1;
	if (!m || month < 0) return null;
	return `${m[3]}-${String(month + 1).padStart(2, '0')}-${m[2].padStart(2, '0')}`;
}

/** "7:30am" → "07:30"; "12pm" → "12:00"; "12am" → "00:00", or "24:00" as an end time. */
function clock(text: string, isEnd: boolean): string | null {
	const m = /^(\d{1,2})(?::(\d\d))?([ap]m)$/.exec(text);
	if (!m || Number(m[1]) < 1 || Number(m[1]) > 12) return null;
	let h = Number(m[1]) % 12;
	if (m[3] === 'pm') h += 12;
	if (h === 0 && !m[2] && isEnd) return '24:00';
	return `${String(h).padStart(2, '0')}:${m[2] ?? '00'}`;
}

const pattern =
	/^From (.+?) to (.+?) Each ([A-Za-z,]+) from (\S+) to (\S+?)(?: Except the following dates: (.*))?$/;

/** Parses the dataset's date_notes text. Returns an error string instead of throwing. */
export function parseSchedule(notes: string): Schedule | string {
	const m = pattern.exec(notes.trim());
	if (!m) return 'unrecognized schedule text';
	const seasonStart = isoDate(m[1]);
	const seasonEnd = isoDate(m[2]);
	const weekdays = m[3].split(',').map((d) => days.indexOf(d));
	const starts = clock(m[4], false);
	const ends = clock(m[5], true);
	if (!seasonStart || !seasonEnd || seasonEnd < seasonStart) return 'bad date range';
	if (weekdays.includes(-1)) return 'bad weekday';
	if (!starts || !ends || ends <= starts) return 'bad times';
	// Listed as "Monday, Nov 23, 2026 Monday, Nov 23, 2026 …", often repeated.
	const except = [
		...new Set(
			[...(m[6] ?? '').matchAll(/[A-Z][a-z]+day, ([A-Z][a-z]{2} \d{1,2}, \d{4})/g)].map((x) =>
				isoDate(x[1])!
			)
		)
	]
		.filter((d) => d >= seasonStart && d <= seasonEnd)
		.sort();
	return { weekdays: [...new Set(weekdays)].sort(), starts, ends, seasonStart, seasonEnd, except };
}

/** "Gompers (Samuel) Park" → "gompers"; the distinctive first word of the park's everyday name. */
const key = (name: string) =>
	everydayName(name)
		.toLowerCase()
		.split(/[^a-z']+/)[0];

/**
 * The court location a facility's programs belong to: the one within matchMeters whose name shares
 * the facility's first word, else the only location in range. A park split into several sites
 * (several name matches) needs a curation entry; null means "report it".
 */
export function matchFacility(
	facility: string,
	at: LatLng,
	locations: Location[],
	curation: Record<string, string>
): { slug: string } | { problem: string } {
	if (curation[facility]) return { slug: curation[facility] };
	const near = locations.filter((l) => distanceMeters(at, l) <= matchMeters);
	const named = near.filter((l) => key(l.name) === key(facility));
	if (named.length === 1) return { slug: named[0].slug };
	if (named.length > 1)
		return {
			problem: `several sites match (${named.map((l) => l.slug).join(', ')}); add curation`
		};
	if (near.length === 1) return { slug: near[0].slug };
	return { problem: near.length ? 'no name match among nearby sites' : 'no court site nearby' };
}

/** "Cardio Tennis at Gompers" → "Cardio Tennis", only when the suffix names this park. */
function stripPlace(title: string, facility: string): string {
	const m = / at ([^,]+)$/.exec(title);
	return m && key(m[1]) === key(facility) ? title.slice(0, m.index).trim() : title.trim();
}

/** One program's own record in the City dataset: the source link we show. */
export const datasetRecordUrl = (id: string) =>
	`https://data.cityofchicago.org/resource/tn7v-6rnw.json?activity_id=${encodeURIComponent(id)}`;

export type ClassBlock = Schedule & {
	location: string;
	title: string;
	courtsUsed: null; // the dataset doesn't say
	ages: string | null;
	fee: number | null;
	signupUrl: string | null;
	sourceUrl: string;
	verifiedAt: string;
};

/** Tennis only (no table tennis or pickleball), cancelled rows dropped, matched to locations. */
export function transformClasses(
	rows: ActivityRow[],
	locations: Location[],
	curation: Record<string, string>,
	verifiedAt: string
): { classes: ClassBlock[]; report: string } {
	const classes: ClassBlock[] = [];
	const problems: string[] = [];
	const tennis = rows.filter((r) => r.category === 'Sports - Tennis' && !r.event_cancelled);
	for (const r of tennis) {
		const schedule = parseSchedule(r.date_notes);
		if (typeof schedule === 'string') {
			problems.push(`- ${r.activity_id} ${r.title}: ${schedule} ("${r.date_notes}")`);
			continue;
		}
		const at = { lat: Number(r.latitude), lng: Number(r.longitude) };
		const match = matchFacility(r.location_facility, at, locations, curation);
		if ('problem' in match) {
			problems.push(`- ${r.activity_id} ${r.title} at ${r.location_facility}: ${match.problem}`);
			continue;
		}
		const fee = Number(r.fee);
		classes.push({
			location: match.slug,
			// "Cardio Tennis at Gompers" → "Cardio Tennis": the park page already says where.
			title: stripPlace(r.title, r.location_facility),
			...schedule,
			courtsUsed: null,
			ages: r.age_range?.trim() || null,
			fee: r.fee !== undefined && Number.isFinite(fee) ? fee : null,
			signupUrl: r.information_link?.url.replace(/^http:\/\//, 'https://') ?? null,
			sourceUrl: datasetRecordUrl(r.activity_id),
			verifiedAt
		});
	}
	classes.sort(
		(a, b) =>
			a.location.localeCompare(b.location) ||
			a.seasonStart.localeCompare(b.seasonStart) ||
			a.sourceUrl.localeCompare(b.sourceUrl)
	);
	const perSite = new Map<string, number>();
	for (const c of classes) perSite.set(c.location, (perSite.get(c.location) ?? 0) + 1);
	const report = [
		'# Class data report',
		'',
		`Tennis programs in the dataset: ${tennis.length}; matched: ${classes.length}; skipped: ${problems.length}.`,
		'',
		'## Programs per court site',
		...[...perSite].map(([slug, n]) => `- ${slug}: ${n}`),
		'',
		'## Skipped',
		...(problems.length ? problems : ['- none'])
	].join('\n');
	return { classes, report: report + '\n' };
}
