import { describe, expect, it } from 'vitest';
import {
	addDays,
	dayRanges,
	formatDate,
	chicagoTime,
	courtStatus,
	describeStatus,
	formatClock,
	intervalsOn
} from './status';
import type { ClassRow, HoursRow } from './types';

// Park District default: 6 AM–11 PM every day.
const everyDay = (opens = '06:00', closes = '23:00'): HoursRow[] =>
	Array.from({ length: 7 }, (_, weekday) => ({
		weekday,
		opens,
		closes,
		seasonStart: null,
		seasonEnd: null
	}));

// Tuesdays 4–6 PM, 2 courts, summer only.
const juniors: ClassRow = {
	title: 'Junior tennis',
	weekday: 2,
	starts: '16:00',
	ends: '18:00',
	courtsUsed: 2,
	seasonStart: '2026-06-01',
	seasonEnd: '2026-08-31'
};

// Instants written with their Chicago offset (CDT −05:00 in summer, CST −06:00 in winter).
const at = (iso: string) => new Date(iso);
const status = (iso: string, hours = everyDay(), classes: ClassRow[] = [juniors], courts = 4) =>
	courtStatus(courts, hours, classes, at(iso));

describe('chicagoTime', () => {
	it('converts instants to Chicago date, weekday and minutes', () => {
		expect(chicagoTime(at('2026-07-14T16:30:00-05:00'))).toEqual({
			date: '2026-07-14',
			weekday: 2,
			minutes: 16 * 60 + 30
		});
		// 03:30 UTC on Jul 15 is still Jul 14 in Chicago.
		expect(chicagoTime(at('2026-07-15T03:30:00Z')).date).toBe('2026-07-14');
	});

	it('addDays crosses months and years', () => {
		expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
		expect(addDays('2026-03-07', 2)).toBe('2026-03-09');
	});
});

describe('courtStatus', () => {
	it('open, with the next class flagged', () => {
		expect(status('2026-07-14T10:00:00-05:00')).toEqual({
			state: 'open',
			until: '23:00',
			nextClassAt: '16:00'
		});
	});

	it('class in progress with some courts free', () => {
		expect(status('2026-07-14T16:30:00-05:00')).toEqual({
			state: 'class',
			until: '18:00',
			courtsFree: 2,
			titles: ['Junior tennis']
		});
	});

	it('class boundaries: starts inclusive, ends exclusive', () => {
		expect(status('2026-07-14T16:00:00-05:00').state).toBe('class');
		expect(status('2026-07-14T18:00:00-05:00').state).toBe('open');
	});

	it('overlapping classes add up, capped at the court count', () => {
		const adults = {
			...juniors,
			title: 'Adult clinic',
			starts: '17:00',
			ends: '19:00',
			courtsUsed: 3
		};
		expect(status('2026-07-14T17:30:00-05:00', everyDay(), [juniors, adults])).toEqual({
			state: 'class',
			until: '18:00',
			courtsFree: 0,
			titles: ['Junior tennis', 'Adult clinic']
		});
	});

	it('a class running past closing ends "until" at closing', () => {
		const late = { ...juniors, starts: '22:00', ends: '23:30' };
		expect(status('2026-07-14T22:15:00-05:00', everyDay(), [late])).toMatchObject({
			state: 'class',
			until: '23:00'
		});
	});

	it('classes only count in season and on their weekday', () => {
		expect(status('2026-09-01T16:30:00-05:00').state).toBe('open'); // Tue, after season
		expect(status('2026-07-15T16:30:00-05:00').state).toBe('open'); // Wed
	});

	it('closed before opening: opens later today', () => {
		expect(status('2026-07-14T05:00:00-05:00')).toEqual({
			state: 'closed',
			nextOpen: { time: '06:00', inDays: 0, weekday: 2, date: '2026-07-14' }
		});
	});

	it('closed after closing: opens tomorrow', () => {
		expect(status('2026-07-14T23:30:00-05:00')).toEqual({
			state: 'closed',
			nextOpen: { time: '06:00', inDays: 1, weekday: 3, date: '2026-07-15' }
		});
	});

	it('skips closed weekdays when finding the next opening', () => {
		const noSunday = everyDay().filter((h) => h.weekday !== 0);
		// Saturday 11:30 PM → Sunday closed → Monday 6 AM.
		expect(status('2026-07-18T23:30:00-05:00', noSunday)).toEqual({
			state: 'closed',
			nextOpen: { time: '06:00', inDays: 2, weekday: 1, date: '2026-07-20' }
		});
	});

	it('no hours at all → closed with no next opening', () => {
		expect(status('2026-07-14T12:00:00-05:00', [])).toEqual({ state: 'closed', nextOpen: null });
	});

	it('seasonal hours win in season; year-round hours apply outside it', () => {
		const summer = everyDay('07:00', '21:00').map((h) => ({
			...h,
			seasonStart: '2026-05-01',
			seasonEnd: '2026-10-31'
		}));
		const hours = [...everyDay(), ...summer];
		expect(status('2026-07-14T21:30:00-05:00', hours, []).state).toBe('closed');
		expect(status('2026-11-10T21:30:00-06:00', hours, []).state).toBe('open');
		expect(intervalsOn(hours, '2026-07-14', 2)).toEqual([{ opens: 420, closes: 1260 }]);
	});

	it('seasonal courts: closed for the season, with the next season months ahead', () => {
		// Diversey style: open only May 18 – Oct 12, 2027.
		const summer = everyDay().map((h) => ({
			...h,
			seasonStart: '2027-05-18',
			seasonEnd: '2027-10-12'
		}));
		const note = 'open mid-May to mid-October';
		const winter = status('2026-12-01T12:00:00-06:00', summer, []);
		expect(winter).toEqual({
			state: 'closed',
			nextOpen: { time: '06:00', inDays: 168, weekday: 2, date: '2027-05-18' }
		});
		expect(describeStatus(winter, 4, note)).toEqual({
			label: 'Closed for the season',
			detail: 'opens May 18'
		});

		// Next season not published yet: the note says when to expect it.
		const after = status('2027-10-20T12:00:00-05:00', summer, []);
		expect(describeStatus(after, 4, note)).toEqual({
			label: 'Closed for the season',
			detail: note
		});

		// In season, closed overnight is just "Closed".
		const night = status('2027-06-01T23:30:00-05:00', summer, []);
		expect(describeStatus(night, 4, note)).toEqual({
			label: 'Closed',
			detail: 'opens tomorrow 6 AM'
		});
	});

	it('supports split days (e.g. closed midday)', () => {
		const split: HoursRow[] = [
			{ weekday: 2, opens: '06:00', closes: '12:00', seasonStart: null, seasonEnd: null },
			{ weekday: 2, opens: '13:00', closes: '23:00', seasonStart: null, seasonEnd: null }
		];
		expect(status('2026-07-14T12:30:00-05:00', split, [])).toEqual({
			state: 'closed',
			nextOpen: { time: '13:00', inDays: 0, weekday: 2, date: '2026-07-14' }
		});
	});

	it('accepts Postgres HH:MM:SS times', () => {
		const pg = everyDay('06:00:00', '23:00:00');
		expect(status('2026-07-14T10:00:00-05:00', pg, [])).toMatchObject({
			state: 'open',
			until: '23:00'
		});
	});
});

describe('daylight saving', () => {
	// 2026-03-08: clocks jump 2:00 CST → 3:00 CDT. 2026-11-01: 2:00 CDT → 1:00 CST.
	it('spring forward day', () => {
		expect(chicagoTime(at('2026-03-08T07:30:00Z')).minutes).toBe(90); // 1:30 CST
		expect(chicagoTime(at('2026-03-08T08:30:00Z')).minutes).toBe(210); // 3:30 CDT (2:30 skipped)
		expect(status('2026-03-08T08:30:00Z', everyDay(), [])).toEqual({
			state: 'closed',
			nextOpen: { time: '06:00', inDays: 0, weekday: 0, date: '2026-03-08' }
		});
		expect(status('2026-03-08T11:00:00Z', everyDay(), []).state).toBe('open'); // 6:00 CDT
		expect(status('2026-03-08T10:30:00Z', everyDay(), []).state).toBe('closed'); // 5:30 CDT
	});

	it('fall back day (1:30 AM happens twice)', () => {
		expect(chicagoTime(at('2026-11-01T06:30:00Z')).minutes).toBe(90); // 1:30 CDT
		expect(chicagoTime(at('2026-11-01T07:30:00Z')).minutes).toBe(90); // 1:30 CST
		expect(status('2026-11-01T07:30:00Z', everyDay(), []).state).toBe('closed');
		expect(status('2026-11-02T04:30:00Z', everyDay(), [])).toMatchObject({ state: 'open' }); // 10:30 PM CST Sun
		expect(status('2026-11-02T05:30:00Z', everyDay(), [])).toEqual({
			state: 'closed',
			nextOpen: { time: '06:00', inDays: 1, weekday: 1, date: '2026-11-02' }
		}); // 11:30 PM CST Sun
	});
});

describe('formatting', () => {
	it.each([
		['23:00', '11 PM'],
		['07:30', '7:30 AM'],
		['12:00', 'Noon'],
		['00:00', 'Midnight'],
		['12:45', '12:45 PM'],
		['06:00:00', '6 AM']
	])('formatClock(%s) = %s', (t, expected) => {
		expect(formatClock(t)).toBe(expected);
	});

	it('describeStatus never claims real-time occupancy', () => {
		expect(describeStatus({ state: 'open', until: '23:00', nextClassAt: null }, 4)).toEqual({
			label: 'Open now',
			detail: 'closes 11 PM'
		});
		expect(describeStatus({ state: 'open', until: '23:00', nextClassAt: '16:00' }, 4).detail).toBe(
			'class at 4 PM · closes 11 PM'
		);
		expect(
			describeStatus({ state: 'class', until: '18:00', courtsFree: 2, titles: [] }, 4).detail
		).toBe('2 of 4 courts free until 6 PM');
		expect(
			describeStatus({ state: 'class', until: '18:00', courtsFree: 0, titles: [] }, 4).detail
		).toBe('all courts in use until 6 PM');
		expect(
			describeStatus(
				{ state: 'closed', nextOpen: { time: '06:00', inDays: 1, weekday: 3, date: '2026-07-15' } },
				4
			).detail
		).toBe('opens tomorrow 6 AM');
		expect(
			describeStatus(
				{ state: 'closed', nextOpen: { time: '06:00', inDays: 2, weekday: 1, date: '2026-07-20' } },
				4
			).detail
		).toBe('opens Mon 6 AM');
		expect(describeStatus({ state: 'closed', nextOpen: null }, 4).detail).toBe('no upcoming hours');
	});
});

describe('dayRanges', () => {
	it.each([
		[[1, 2, 3, 4, 5], 'Mon–Fri'],
		[[6, 0], 'Sat–Sun'],
		[[0, 1, 2, 3, 4, 5, 6], 'Mon–Sun'],
		[[1, 3, 5], 'Mon, Wed, Fri'],
		[[1, 2, 4], 'Mon–Tue, Thu'],
		[[0], 'Sun']
	])('%j → %s', (days, text) => {
		expect(dayRanges(days)).toBe(text);
	});

	it('formatDate shows the calendar date without time-zone shift', () => {
		expect(formatDate('2026-12-31')).toBe('Dec 31, 2026');
	});
});
