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
const toClock = (m: number) =>
	`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

/** Adds days to a YYYY-MM-DD date (calendar arithmetic in UTC, so DST can't shift the day). */
export function addDays(date: string, days: number): string {
	const d = new Date(`${date}T00:00:00Z`);
	d.setUTCDate(d.getUTCDate() + days);
	return d.toISOString().slice(0, 10);
}

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
				nextOpen: { time: toClock(later.opens), inDays: 0, weekday: local.weekday }
			};
		for (let d = 1; d <= 7; d++) {
			const weekday = (local.weekday + d) % 7;
			const [first] = intervalsOn(hours, addDays(local.date, d), weekday);
			if (first)
				return { state: 'closed', nextOpen: { time: toClock(first.opens), inDays: d, weekday } };
		}
		return { state: 'closed', nextOpen: null };
	}

	const todaysClasses = classes
		.filter((c) => c.weekday === local.weekday && inSeason(local.date, c.seasonStart, c.seasonEnd))
		.map((c) => ({ ...c, from: toMinutes(c.starts), to: toMinutes(c.ends) }));
	const active = todaysClasses.filter((c) => c.from <= m && m < c.to);

	if (active.length) {
		const used = Math.min(
			active.reduce((sum, c) => sum + c.courtsUsed, 0),
			courtCount
		);
		const until = Math.min(open.closes, ...active.map((c) => c.to));
		return {
			state: 'class',
			until: toClock(until),
			courtsFree: courtCount - used,
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
	courtCount: number
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
					s.courtsFree > 0
						? `${s.courtsFree} of ${courtCount} courts free until ${formatClock(s.until)}`
						: `all courts in use until ${formatClock(s.until)}`
			};
		case 'closed': {
			if (!s.nextOpen) return { label: 'Closed', detail: 'no upcoming hours' };
			const when =
				s.nextOpen.inDays === 0
					? ''
					: s.nextOpen.inDays === 1
						? 'tomorrow '
						: `${dayNames[s.nextOpen.weekday]} `;
			return { label: 'Closed', detail: `opens ${when}${formatClock(s.nextOpen.time)}` };
		}
	}
}
