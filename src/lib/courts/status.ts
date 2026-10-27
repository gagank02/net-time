// Court status from hours + class blocks, in Chicago time. Pure and isomorphic: the server renders
// it, the browser recomputes it every minute. Data is wall-clock local time, so daylight-saving
// changes need no special cases beyond converting "now" to Chicago time.
import type { ClassRow, CourtStatus, HoursRow } from './types';

export const timeZone = 'America/Chicago';

const parts = new Intl.DateTimeFormat('en-US', {
	timeZone,
	year: 'numeric',
	month: '2-digit',
	day: '2-digit',
	weekday: 'short',
	hour: '2-digit',
	minute: '2-digit',
	hourCycle: 'h23'
});
const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export type LocalTime = { date: string; weekday: number; minutes: number };

/** The Chicago calendar date, weekday and minutes-since-midnight for an instant. */
export function chicagoTime(now: Date): LocalTime {
	const p = Object.fromEntries(parts.formatToParts(now).map((x) => [x.type, x.value]));
	return {
		date: `${p.year}-${p.month}-${p.day}`,
		weekday: weekdays.indexOf(p.weekday),
		minutes: Number(p.hour) * 60 + Number(p.minute)
	};
}

const toMinutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
export const toClock = (m: number) =>
	`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

/** Adds days to a YYYY-MM-DD date (calendar arithmetic in UTC, so DST can't shift the day). */
export function addDays(date: string, days: number): string {
	const d = new Date(`${date}T00:00:00Z`);
	d.setUTCDate(d.getUTCDate() + days);
	return d.toISOString().slice(0, 10);
}

const daysBetween = (from: string, to: string) =>
	Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

const inSeason = (date: string, start: string | null, end: string | null) =>
	start === null || end === null || (date >= start && date <= end);

/** Open intervals for a date: seasonal rows win over year-round rows when both apply. */
export function intervalsOn(hours: HoursRow[], date: string, weekday: number) {
	const today = hours.filter(
		(h) => h.weekday === weekday && inSeason(date, h.seasonStart, h.seasonEnd)
	);
	const seasonal = today.filter((h) => h.seasonStart !== null);
	return (seasonal.length ? seasonal : today)
		.map((h) => ({ opens: toMinutes(h.opens), closes: toMinutes(h.closes) }))
		.sort((a, b) => a.opens - b.opens);
}

export function courtStatus(
	courtCount: number,
	hours: HoursRow[],
	classes: ClassRow[],
	now: Date
): CourtStatus {
	const local = chicagoTime(now);
	const m = local.minutes;
	const today = intervalsOn(hours, local.date, local.weekday);
	const open = today.find((i) => i.opens <= m && m < i.closes);

	if (!open) {
		const later = today.find((i) => i.opens > m);
		if (later)
			return {
				state: 'closed',
				nextOpen: {
					time: toClock(later.opens),
					inDays: 0,
					weekday: local.weekday,
					date: local.date
				}
			};
		// The coming week, then the start of the next known season (e.g. a court closed for winter).
		const seasonStarts = hours
			.map((h) => h.seasonStart)
			.filter((s): s is string => s !== null && s > addDays(local.date, 7))
			.sort();
		const days = [1, 2, 3, 4, 5, 6, 7].map((d) => addDays(local.date, d));
		if (seasonStarts[0]) days.push(seasonStarts[0]);
		for (const date of days) {
			const inDays = daysBetween(local.date, date);
			const weekday = (local.weekday + inDays) % 7;
			const [first] = intervalsOn(hours, date, weekday);
			if (first)
				return { state: 'closed', nextOpen: { time: toClock(first.opens), inDays, weekday, date } };
		}
		return { state: 'closed', nextOpen: null };
	}

	const todaysClasses = classes
		.filter(
			(c) =>
				c.weekdays.includes(local.weekday) &&
				inSeason(local.date, c.seasonStart, c.seasonEnd) &&
				!c.except.includes(local.date)
		)
		.map((c) => ({ ...c, from: toMinutes(c.starts), to: toMinutes(c.ends) }));
	const active = todaysClasses.filter((c) => c.from <= m && m < c.to);

	if (active.length) {
		// Free courts only when every running class says how many it uses; never a guess.
		const known = active.every((c) => c.courtsUsed !== null);
		const used = Math.min(
			active.reduce((sum, c) => sum + (c.courtsUsed ?? 0), 0),
			courtCount
		);
		const until = Math.min(open.closes, ...active.map((c) => c.to));
		return {
			state: 'class',
			until: toClock(until),
			courtsFree: known ? courtCount - used : null,
			titles: active.map((c) => c.title)
		};
	}

	const next = todaysClasses
		.filter((c) => c.from > m && c.from < open.closes)
		.sort((a, b) => a.from - b.from)[0];
	return {
		state: 'open',
		until: toClock(open.closes),
		nextClassAt: next ? toClock(next.from) : null
	};
}

/** "23:00" → "11 PM", "07:30" → "7:30 AM", "12:00" → "Noon", "00:00" → "Midnight". */
export function formatClock(t: string): string {
	const min = toMinutes(t);
	if (min === 12 * 60) return 'Noon';
	if (min === 0 || min === 24 * 60) return 'Midnight';
	const h = Math.floor(min / 60) % 12 || 12;
	const mm = min % 60;
	return `${h}${mm ? `:${String(mm).padStart(2, '0')}` : ''} ${min < 12 * 60 ? 'AM' : 'PM'}`;
}

const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Short UI text: a label (what) and a detail (until when). Never claims real-time occupancy. */
export function describeStatus(
	s: CourtStatus,
	courtCount: number,
	seasonNote: string | null = null
): { label: string; detail: string } {
	switch (s.state) {
		case 'open':
			return {
				label: 'Open now',
				detail: s.nextClassAt
					? `class at ${formatClock(s.nextClassAt)} · closes ${formatClock(s.until)}`
					: `closes ${formatClock(s.until)}`
			};
		case 'class':
			return {
				label: 'Class in progress',
				detail:
					s.courtsFree === null
						? `some courts may be in use until ${formatClock(s.until)}`
						: s.courtsFree > 0
							? `${s.courtsFree} of ${courtCount} courts free until ${formatClock(s.until)}`
							: `all courts in use until ${formatClock(s.until)}`
			};
		case 'closed': {
			const seasonal = seasonNote !== null && (!s.nextOpen || s.nextOpen.inDays > 7);
			const label = seasonal ? 'Closed for the season' : 'Closed';
			if (!s.nextOpen) return { label, detail: seasonNote ?? 'no upcoming hours' };
			if (s.nextOpen.inDays > 6) return { label, detail: `opens ${shortDate(s.nextOpen.date)}` };
			const when =
				s.nextOpen.inDays === 0
					? ''
					: s.nextOpen.inDays === 1
						? 'tomorrow '
						: `${dayNames[s.nextOpen.weekday]} `;
			return { label, detail: `opens ${when}${formatClock(s.nextOpen.time)}` };
		}
	}
}

/** "2027-05-18" → "May 18". */
const shortDate = (date: string) =>
	new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(
		new Date(`${date}T00:00:00Z`)
	);

const longDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const mondayFirst = [1, 2, 3, 4, 5, 6, 0];

/** Weekdays as compact ranges in Mon→Sun order: [1,2,3,4,5] → "Mon–Fri", [6,0] → "Sat–Sun". */
export function dayRanges(weekdays: number[]): string {
	const runs: number[][] = [];
	for (const d of mondayFirst.filter((d) => weekdays.includes(d))) {
		const last = runs.at(-1);
		const adjacent = last && mondayFirst.indexOf(d) === mondayFirst.indexOf(last.at(-1)!) + 1;
		if (adjacent) last.push(d);
		else runs.push([d]);
	}
	return runs
		.map((r) => (r.length > 1 ? `${dayNames[r[0]]}–${dayNames[r.at(-1)!]}` : dayNames[r[0]]))
		.join(', ');
}

export const dayName = (weekday: number) => longDays[weekday];

/** "2026-10-25" → "Oct 25, 2026" (calendar date, no time zone shift). */
export const formatDate = (date: string) =>
	new Intl.DateTimeFormat('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
		timeZone: 'UTC'
	}).format(new Date(`${date}T00:00:00Z`));
