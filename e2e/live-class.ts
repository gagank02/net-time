import { readFileSync } from 'node:fs';
import { addDays, chicagoTime } from '../src/lib/courts/status.ts';

// Class data is refreshed weekly from the City, so tests can't hard-code a program: this picks one
// that is in the current data and finds an instant when it is the only class running at its site.

type Block = {
	location: string;
	title: string;
	weekdays: number[];
	starts: string;
	ends: string;
	seasonStart: string;
	seasonEnd: string;
	except: string[];
};

const read = (file: string) => JSON.parse(readFileSync(`data/${file}`, 'utf8'));
const blocks: Block[] = read('classes.cpd.json').classes;
const names = new Map<string, string>(
	read('courts.seed.json').locations.map((l: { slug: string; name: string }) => [l.slug, l.name])
);
// Sites with their own hours are skipped, so the Park District default (6 AM – 11 PM) applies.
const overridden = new Set(
	read('hours.overrides.json').overrides.map((o: { slug: string }) => o.slug)
);

/** The instant at Chicago wall-clock `date` + `time` (tries CDT, then CST). */
function chicagoInstant(date: string, time: string): string {
	for (const offset of ['-05:00', '-06:00']) {
		const iso = `${date}T${time}:00${offset}`;
		const t = chicagoTime(new Date(iso));
		if (t.date === date && t.minutes === Number(time.slice(0, 2)) * 60 + Number(time.slice(3)))
			return iso;
	}
	throw new Error(`no Chicago instant for ${date} ${time}`);
}

const plus10 = (t: string) => {
	const m = Number(t.slice(0, 2)) * 60 + Number(t.slice(3)) + 10;
	return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

export function liveClass(): { slug: string; name: string; title: string; iso: string } {
	const today = chicagoTime(new Date()).date;
	for (const b of blocks) {
		const time = plus10(b.starts);
		if (overridden.has(b.location) || b.starts < '06:00' || time >= b.ends || time >= '23:00')
			continue;
		for (
			let date = b.seasonStart > today ? b.seasonStart : today;
			date <= b.seasonEnd;
			date = addDays(date, 1)
		) {
			const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
			if (!b.weekdays.includes(weekday) || b.except.includes(date)) continue;
			const running = blocks.filter(
				(o) =>
					o.location === b.location &&
					o.weekdays.includes(weekday) &&
					o.seasonStart <= date &&
					o.seasonEnd >= date &&
					!o.except.includes(date) &&
					o.starts <= time &&
					time < o.ends
			);
			if (running.length === 1)
				return {
					slug: b.location,
					name: names.get(b.location)!,
					title: b.title,
					iso: chicagoInstant(date, time)
				};
			break; // try the next block
		}
	}
	throw new Error('no upcoming class in data/classes.cpd.json');
}
