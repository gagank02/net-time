import { describe, expect, it } from 'vitest';
import { courtSlugs, getCourt, listCourts } from './data';

describe('build-time court data', () => {
	it('lists every seeded court, sorted by name, with areas and ZIPs', () => {
		const { courts, areas, zips } = listCourts('2026-10-25');
		expect(courts).toHaveLength(courtSlugs.length);
		expect(courts.map((c) => c.name)).toEqual(
			[...courts.map((c) => c.name)].sort((a, b) => a.localeCompare(b, 'en'))
		);
		expect(areas).toHaveLength(77);
		expect(zips.length).toBeGreaterThan(50);
	});

	it('uses Park District default hours unless a park has an override with a source', () => {
		const oz = getCourt('oz-park', '2026-10-25')!;
		expect(oz.hours).toHaveLength(7);
		expect(oz.hours[0]).toMatchObject({ weekday: 0, opens: '06:00', closes: '23:00' });
		expect(oz.hoursSourceUrl).toBeNull();

		const maggie = getCourt('maggie-daley-park', '2026-10-25')!;
		expect(maggie.hours[0]).toMatchObject({ opens: '07:00', closes: '21:00' });
		expect(maggie.hoursSourceUrl).toMatch(/^https:\/\//);
	});

	it('merges City classes; drops ended ones; the list omits sources, the detail keeps them', () => {
		// Whatever the current data holds: a site with a class, on a date before that class ends.
		const site = listCourts('2000-01-01').courts.find((c) => c.classes.length)!;
		const ends = site.classes[0].seasonEnd;
		const detail = getCourt(site.slug, ends)!;
		expect(detail.classes.length).toBeGreaterThan(0);
		expect(detail.classes[0].sourceUrl).toMatch(/^https:\/\//);
		expect(site.classes[0]).not.toHaveProperty('sourceUrl');

		const later = '9999-12-31';
		expect(getCourt(site.slug, later)!.classes).toEqual([]);
	});

	it('returns null for an unknown slug', () => {
		expect(getCourt('no-such-park', '2026-10-25')).toBeNull();
	});
});
