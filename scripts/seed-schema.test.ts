import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
	AreasSeed,
	ClassesSeed,
	CourtLocationSeed,
	CourtsSeed,
	HoursOverridesSeed,
	HoursSeed
} from './seed-schema';

const fixture = (file: string) =>
	JSON.parse(readFileSync(new URL(`./fixtures/seed/${file}`, import.meta.url), 'utf8'));

const oz = fixture('courts.seed.json').locations[0];

describe('seed schemas', () => {
	it('accept the fixture seed', () => {
		expect(CourtsSeed.safeParse(fixture('courts.seed.json')).success).toBe(true);
		expect(AreasSeed.safeParse(fixture('areas.seed.json')).success).toBe(true);
		expect(HoursOverridesSeed.safeParse(fixture('hours.overrides.json')).success).toBe(true);
		expect(ClassesSeed.safeParse(fixture('classes.seed.json')).success).toBe(true);
	});

	it.each([
		['bad slug', { slug: 'Oz Park!' }],
		['path-like slug', { slug: '../admin' }],
		['name too long', { name: 'x'.repeat(121) }],
		['control characters', { name: 'Oz\u0000Park' }],
		['outside Chicago', { lat: 40.71, lng: -74.0 }],
		['court count 0', { courtCount: 0 }],
		['unknown surface', { surface: 'carpet' }],
		['bad osm id', { osmIds: ['way/1; drop table'] }],
		['bad date', { verifiedAt: '25/10/2026' }],
		['unknown key (typo)', { courtcount: 4 }]
	])('rejects a location with %s', (_, patch) => {
		expect(CourtLocationSeed.safeParse({ ...oz, ...patch }).success).toBe(false);
	});

	it('rejects duplicate slugs', () => {
		const seed = { generatedAt: '2026-10-25T00:00:00Z', locations: [oz, oz] };
		expect(CourtsSeed.safeParse(seed).success).toBe(false);
	});

	it('rejects hours that close before opening or bad times', () => {
		expect(HoursSeed.safeParse({ weekday: 1, opens: '21:00', closes: '07:00' }).success).toBe(
			false
		);
		expect(HoursSeed.safeParse({ weekday: 1, opens: '7am', closes: '21:00' }).success).toBe(false);
		expect(HoursSeed.safeParse({ weekday: 7, opens: '07:00', closes: '21:00' }).success).toBe(
			false
		);
		expect(
			HoursSeed.safeParse({
				weekday: 1,
				opens: '07:00',
				closes: '21:00',
				seasonStart: '2026-05-01'
			}).success
		).toBe(false);
	});

	it('rejects classes with non-https links, inverted times or no days', () => {
		const good = fixture('classes.seed.json').classes[0];
		const bad = (patch: object) =>
			ClassesSeed.safeParse({ classes: [{ ...good, ...patch }] }).success;
		expect(bad({ sourceUrl: 'http://example.com' })).toBe(false);
		expect(bad({ sourceUrl: 'javascript:alert(1)' })).toBe(false);
		expect(bad({ starts: '18:00', ends: '16:00' })).toBe(false);
		expect(bad({ seasonStart: '2026-09-01', seasonEnd: '2026-06-01' })).toBe(false);
		expect(bad({ weekdays: [] })).toBe(false);
		expect(bad({ signupUrl: 'http://example.com' })).toBe(false);
		expect(bad({ ends: '24:00' })).toBe(true); // leagues that run to midnight
		expect(bad({ ends: '24:30' })).toBe(false);
	});
});
