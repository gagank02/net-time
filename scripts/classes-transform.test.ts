import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
	matchFacility,
	parseSchedule,
	transformClasses,
	type ActivityRow,
	type Location
} from './classes-transform';

// Real rows from the City dataset (tn7v-6rnw), trimmed to the fields we read.
const rows: ActivityRow[] = JSON.parse(
	readFileSync('scripts/fixtures/cpd-activities.json', 'utf8')
);

const locations: Location[] = [
	{ slug: 'maggie-daley-park', name: 'Maggie Daley Park', lat: 41.883943, lng: -87.615957 },
	{ slug: 'athletic-field-park', name: 'Athletic Field Park', lat: 41.94723, lng: -87.716736 },
	{
		slug: 'mcfetridge-sports-center',
		name: 'McFetridge Sports Center (indoor)',
		lat: 41.95207,
		lng: -87.697025
	},
	{ slug: 'mckinley-park-north', name: 'McKinley Park (north)', lat: 41.826358, lng: -87.677 },
	{ slug: 'mckinley-park-south', name: 'McKinley Park (south)', lat: 41.824502, lng: -87.683845 }
];

describe('parseSchedule', () => {
	it('reads days, times and the date range', () => {
		expect(
			parseSchedule(
				'From September 14, 2026 to October 26, 2026 Each Monday,Tuesday,Wednesday,Thursday from 5pm to 8pm'
			)
		).toEqual({
			weekdays: [1, 2, 3, 4],
			starts: '17:00',
			ends: '20:00',
			seasonStart: '2026-09-14',
			seasonEnd: '2026-10-26',
			except: []
		});
	});

	it('handles half hours, noon and a class running to midnight', () => {
		expect(
			parseSchedule('From October 30, 2026 to December 4, 2026 Each Friday from 7:30am to 12pm')
		).toMatchObject({ starts: '07:30', ends: '12:00' });
		expect(
			parseSchedule('From September 16, 2026 to December 9, 2026 Each Wednesday from 10pm to 12am')
		).toMatchObject({ starts: '22:00', ends: '24:00' });
	});

	it('dedupes skipped dates and keeps only those inside the range', () => {
		expect(
			parseSchedule(
				'From April 9, 2026 to October 29, 2026 Each Thursday from 10am to 11:30am Except the following dates: Thursday, Apr 23, 2026 Thursday, Apr 23, 2026 Thursday, Jun 4, 2026 Thursday, Dec 3, 2026'
			)
		).toMatchObject({ except: ['2026-04-23', '2026-06-04'] });
	});

	it('returns an error instead of throwing on text it does not know', () => {
		expect(parseSchedule('Every other Tuesday, call for times')).toBe('unrecognized schedule text');
		expect(parseSchedule('From May 1, 2026 to April 1, 2026 Each Monday from 5pm to 6pm')).toBe(
			'bad date range'
		);
		expect(parseSchedule('From May 1, 2026 to June 1, 2026 Each Funday from 5pm to 6pm')).toBe(
			'bad weekday'
		);
		expect(parseSchedule('From May 1, 2026 to June 1, 2026 Each Monday from 6pm to 5pm')).toBe(
			'bad times'
		);
	});
});

describe('matchFacility', () => {
	it('matches by name within range, and needs curation for a park with several sites', () => {
		const at = { lat: 41.8830427192, lng: -87.6183968782 };
		expect(matchFacility('Maggie Daley Park', at, locations, {})).toEqual({
			slug: 'maggie-daley-park'
		});
		const mckinley = { lat: 41.8237382, lng: -87.6824446 };
		expect(matchFacility('McKinley (William) Park', mckinley, locations, {})).toEqual({
			problem: 'several sites match (mckinley-park-north, mckinley-park-south); add curation'
		});
		expect(
			matchFacility('McKinley (William) Park', mckinley, locations, {
				'McKinley (William) Park': 'mckinley-park-south'
			})
		).toEqual({ slug: 'mckinley-park-south' });
		expect(matchFacility('Far Away Park', { lat: 41.7, lng: -87.6 }, locations, {})).toEqual({
			problem: 'no court site nearby'
		});
	});
});

describe('transformClasses', () => {
	it('keeps tennis only, matches sites, cleans titles and links, and reports what it skipped', () => {
		const { classes, report } = transformClasses(rows, locations, {}, '2026-10-26');
		expect(classes.map((c) => c.location)).toEqual([
			'athletic-field-park',
			'maggie-daley-park',
			'mcfetridge-sports-center'
		]);
		expect(classes[1]).toMatchObject({
			title: 'Tennis Partnership',
			weekdays: [1, 2, 3, 4],
			ages: 'All Ages',
			fee: 145,
			signupUrl: 'https://apm.activecommunities.com/chicagoparkdistrict/Activity_Search/589646',
			sourceUrl: 'https://data.cityofchicago.org/resource/tn7v-6rnw.json?activity_id=589646',
			verifiedAt: '2026-10-26'
		});
		expect(classes[2]).toMatchObject({ ends: '24:00', except: ['2026-11-25'] });
		expect(report).toContain('Tennis programs in the dataset: 4; matched: 3; skipped: 1.');
		expect(report).toContain('558965 Veterans Tennis at McKinley at McKinley (William) Park');
		expect(report).not.toContain('Table Tennis');
	});

	it('drops cancelled programs', () => {
		const cancelled = rows.map((r) => ({ ...r, event_cancelled: true }));
		expect(transformClasses(cancelled, locations, {}, '2026-10-26').classes).toEqual([]);
	});
});
