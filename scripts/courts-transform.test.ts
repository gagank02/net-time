import { describe, expect, it } from 'vitest';
import { distanceMeters } from '../src/lib/geo';
import { CourtsSeed, AreasSeed } from './seed-schema';
import {
	assembleRings,
	buildCourtsSeed,
	centroid,
	everydayName,
	inPolygons,
	slugify,
	titleCase,
	type Input,
	type Polygon
} from './courts-transform';

// A ~400 m square around (lat, lng), as a GeoJSON-style polygon of [lng, lat] pairs.
const square = (lat: number, lng: number, half = 0.002): Polygon => [
	[
		[lng - half, lat - half],
		[lng + half, lat - half],
		[lng + half, lat + half],
		[lng - half, lat + half],
		[lng - half, lat - half]
	]
];

const pitch = (id: number, lat: number, lng: number, tags: Record<string, string> = {}) => ({
	id: `way/${id}`,
	lat,
	lng,
	tags: { leisure: 'pitch', sport: 'tennis', ...tags }
});

const base = (): Input => ({
	pitches: [],
	parks: [],
	tennisAreas: [],
	cpdCourts: [],
	cpdFacilities: [],
	curation: { additions: [], corrections: [], removed: [] },
	communityAreas: [
		{ name: 'LINCOLN PARK', polygons: [square(41.92, -87.65, 0.05)[0]].map((r) => [r]) }
	],
	zips: [{ zip: '60614', polygons: [square(41.92, -87.65, 0.02)] }],
	generatedAt: '2026-10-25T12:00:00Z',
	osmTimestamp: '2026-10-25T11:00:00Z'
});

describe('geometry helpers', () => {
	it('point in polygon respects holes', () => {
		const outer = square(41.9, -87.6, 0.01)[0];
		const hole = square(41.9, -87.6, 0.002)[0];
		expect(inPolygons({ lat: 41.905, lng: -87.6 }, [[outer, hole]])).toBe(true);
		expect(inPolygons({ lat: 41.9, lng: -87.6 }, [[outer, hole]])).toBe(false);
		expect(inPolygons({ lat: 42.5, lng: -87.6 }, [[outer, hole]])).toBe(false);
	});

	it('centroid of a square is its centre', () => {
		const c = centroid([square(41.9, -87.6)]);
		expect(c.lat).toBeCloseTo(41.9, 6);
		expect(c.lng).toBeCloseTo(-87.6, 6);
	});

	it('assembles split multipolygon ways (including reversed ones) into a closed ring', () => {
		const rings = assembleRings([
			[
				[0, 0],
				[1, 0],
				[1, 1]
			],
			[
				[0, 0],
				[0, 1],
				[1, 1]
			] // reversed direction
		]);
		expect(rings).toHaveLength(1);
		expect(rings[0][0]).toEqual(rings[0][rings[0].length - 1]);
	});

	it('everydayName drops the formal honoree', () => {
		expect(everydayName('Lincoln (Abraham) Park')).toBe('Lincoln Park');
		expect(everydayName('Cornell (Paul) Square')).toBe('Cornell Square');
		expect(everydayName('Oz Park')).toBe('Oz Park');
		expect(everydayName('Ashe (Arthur) Beach Park')).toBe('Ashe Beach Park');
		expect(everydayName('Park No. 571 (Big Marsh)')).toBe('Park No. 571 (Big Marsh)');
	});

	it('slugify and titleCase', () => {
		expect(slugify('Lincoln (Abraham) Park – Lake View')).toBe('lincoln-abraham-park-lake-view');
		expect(slugify('Piotrowski & Pułaski')).toBe('piotrowski-and-pulaski');
		expect(titleCase('OZ (L. FRANK)')).toBe('Oz (L. Frank)');
		expect(titleCase('MCKINLEY PARK')).toBe('McKinley Park');
	});
});

describe('buildCourtsSeed', () => {
	it('names courts after the largest containing park, not a named sub-area', () => {
		const input = base();
		input.parks = [
			{ id: 'way/1', name: 'Maggie Daley Park', polygons: [square(41.884, -87.616, 0.004)] },
			{ id: 'way/2', name: 'Peanut Park', polygons: [square(41.884, -87.616, 0.0005)] }
		];
		input.pitches = [pitch(1, 41.884, -87.616)];
		input.cpdFacilities = [{ park: 'MAGGIE DALEY', parkNo: 5, lat: 41.885, lng: -87.617 }];
		expect(buildCourtsSeed(input).courts.locations[0].name).toBe('Maggie Daley Park');
	});

	it('groups courts by containing park and derives fields', () => {
		const input = base();
		input.parks = [{ id: 'way/100', name: 'Oz Park', polygons: [square(41.92, -87.645)] }];
		input.pitches = [
			pitch(1, 41.9201, -87.6451, { lit: 'yes', surface: 'asphalt' }),
			pitch(2, 41.9202, -87.6452, { lit: 'no', surface: 'acrylic' }),
			pitch(3, 41.9203, -87.6453, { surface: 'clay' })
		];
		input.cpdCourts = [{ park: 'OZ (L. FRANK)', parkNo: 12, lat: 41.9201, lng: -87.6451 }];

		const { courts, report } = buildCourtsSeed(input);
		expect(courts.locations).toHaveLength(1);
		expect(courts.locations[0]).toMatchObject({
			slug: 'oz-park',
			name: 'Oz Park',
			courtCount: 3,
			lights: true,
			surface: 'hard',
			indoor: false,
			communityArea: 'Lincoln Park',
			cpdParkNo: 12,
			osmIds: ['way/1', 'way/2', 'way/3'],
			verifiedAt: '2026-10-25'
		});
		expect(CourtsSeed.safeParse(courts).success).toBe(true);
		expect(report).toContain('Park District locations kept: 1**');
	});

	it('excludes court sites with no CPD tennis point nearby and reports them', () => {
		const input = base();
		input.pitches = [pitch(1, 41.93, -87.66)];
		input.cpdCourts = [{ park: 'FAR AWAY', parkNo: 1, lat: 41.95, lng: -87.66 }];
		const { courts, report } = buildCourtsSeed(input);
		expect(courts.locations).toHaveLength(0);
		expect(report).toContain('not inside a CPD park): 1');
		expect(report).toContain('- Far Away');
	});

	it('keeps courts inside a Park District park even when missing from the 2016 tennis list', () => {
		const input = base();
		input.parks = [{ id: 'way/200', name: 'Skinner Park', polygons: [square(41.88, -87.66)] }];
		input.pitches = [pitch(1, 41.8801, -87.6601)];
		// A fieldhouse (not tennis) inside the park, and no tennis point anywhere near.
		input.cpdFacilities = [{ park: 'SKINNER', parkNo: 44, lat: 41.8805, lng: -87.6595 }];
		const { courts, report } = buildCourtsSeed(input);
		expect(courts.locations).toEqual([
			expect.objectContaining({ slug: 'skinner-park', cpdParkNo: 44, courtCount: 1 })
		]);
		expect(report).toContain('not on the 2016 tennis list: 1');
		expect(report).toContain('- Skinner Park · 1 court(s)');
	});

	it('still excludes a park with no Park District facility inside (e.g. a university field)', () => {
		const input = base();
		input.parks = [{ id: 'way/300', name: 'UIC South Fields', polygons: [square(41.86, -87.65)] }];
		input.pitches = [pitch(1, 41.8601, -87.6501)];
		input.cpdFacilities = [{ park: 'ELSEWHERE', parkNo: 9, lat: 41.9, lng: -87.6 }];
		expect(buildCourtsSeed(input).courts.locations).toHaveLength(0);
	});

	it('keeps orphan courts near a CPD point, named from CPD', () => {
		const input = base();
		input.pitches = [pitch(1, 41.91, -87.64), pitch(2, 41.9101, -87.6401)];
		input.cpdCourts = [{ park: 'WRIGHTWOOD', parkNo: 7, lat: 41.9101, lng: -87.64 }];
		const { courts } = buildCourtsSeed(input);
		expect(courts.locations).toEqual([
			expect.objectContaining({ slug: 'wrightwood-park', name: 'Wrightwood Park', courtCount: 2 })
		]);
	});

	it('splits a big park into separate sites and disambiguates names and slugs', () => {
		const input = base();
		input.parks = [
			{ id: 'relation/5', name: 'Lincoln Park', polygons: [square(41.92, -87.64, 0.03)] }
		];
		// Two sites ~1.1 km apart, both in the same community area.
		input.pitches = [pitch(1, 41.91, -87.635), pitch(2, 41.92, -87.635)];
		input.cpdCourts = [
			{ park: 'LINCOLN', parkNo: 1, lat: 41.91, lng: -87.635 },
			{ park: 'LINCOLN', parkNo: 1, lat: 41.92, lng: -87.635 }
		];
		expect(distanceMeters(input.pitches[0], input.pitches[1])).toBeGreaterThan(1000);
		const { courts, report } = buildCourtsSeed(input);
		expect(courts.locations.map((l) => [l.slug, l.name])).toEqual([
			['lincoln-park-north', 'Lincoln Park (north)'],
			['lincoln-park-south', 'Lincoln Park (south)']
		]);
		expect(report).toContain('Lincoln Park: 2 sites');
		expect(report).toContain('Slug collisions resolved\n\n- none');
	});

	it('skips private courts and courts outside every community area', () => {
		const input = base();
		input.pitches = [pitch(1, 41.92, -87.65, { access: 'private' }), pitch(2, 41.6, -87.9)];
		input.cpdCourts = [
			{ park: 'A', parkNo: 1, lat: 41.92, lng: -87.65 },
			{ park: 'B', parkNo: 2, lat: 41.6, lng: -87.9 }
		];
		const { courts, report } = buildCourtsSeed(input);
		expect(courts.locations).toHaveLength(0);
		expect(report).toContain('(1 private/no access, skipped)');
		expect(report).toContain('Excluded, outside community areas: 1');
	});

	it('treats CPD name variants of one park number as the same park', () => {
		const input = base();
		input.pitches = [pitch(1, 41.92, -87.65)];
		input.cpdCourts = [
			{ park: 'MARQUETTE (JACQUES)', parkNo: 10, lat: 41.92, lng: -87.65 },
			{ park: 'MARQUETTE (jACQUES)', parkNo: 10, lat: 41.9201, lng: -87.6501 }
		];
		expect(buildCourtsSeed(input).report).toContain('still unexplained: 0**');
	});

	it('applies curation: adds missing courts at CPD points, records confirmed removals', () => {
		const input = base();
		input.cpdCourts = [
			{ park: 'BELL (GEORGE,JR.)', parkNo: 121, lat: 41.93, lng: -87.66 },
			{ park: 'BELL (GEORGE,JR.)', parkNo: 121, lat: 41.932, lng: -87.66 },
			{ park: 'HIAWATHA', parkNo: 229, lat: 41.94, lng: -87.66 },
			{ park: 'MYSTERY', parkNo: 999, lat: 41.95, lng: -87.66 }
		];
		const by = { verifiedAt: '2026-10-25', verifiedBy: 'project owner' };
		input.curation = {
			corrections: [],
			additions: [
				{
					slug: 'bell-park',
					name: 'Bell Park',
					cpdParkNo: 121,
					access: 'free',
					bookingUrl: null,
					courtCount: 1,
					lights: null,
					surface: null,
					indoor: false,
					note: 'Missing from OSM.',
					...by
				}
			],
			removed: [{ cpdParkNo: 229, park: 'Hiawatha', note: 'Converted to futsal.', ...by }]
		};
		const { courts, report } = buildCourtsSeed(input);
		expect(courts.locations).toEqual([
			expect.objectContaining({
				slug: 'bell-park',
				lat: 41.931,
				lng: -87.66,
				courtCount: 1,
				osmIds: [],
				cpdParkNo: 121
			})
		]);
		expect(report).toContain('added by hand: 1; confirmed removed: 1; **still unexplained: 1**');
		expect(report).toContain(
			'- Hiawatha: Converted to futsal. Verified 2026-10-25 by project owner.'
		);
		expect(report).toContain('- Mystery');
		expect(CourtsSeed.safeParse(courts).success).toBe(true);
	});

	it('adds a separate reservation-only site next to OSM courts of the same park', () => {
		const input = base();
		input.pitches = [pitch(1, 41.95, -87.6974)];
		input.cpdCourts = [{ park: 'CALIFORNIA', parkNo: 189, lat: 41.95, lng: -87.6974 }];
		input.curation.additions = [
			{
				slug: 'mcfetridge-sports-center',
				name: 'McFetridge Sports Center (indoor)',
				cpdParkNo: 189,
				lat: 41.952,
				lng: -87.697,
				access: 'reservation',
				bookingUrl: 'https://example.org/book',
				courtCount: 6,
				lights: true,
				surface: null,
				indoor: true,
				note: 'Indoor.',
				verifiedAt: '2026-10-25',
				verifiedBy: 'owner'
			}
		];
		const { courts, report } = buildCourtsSeed(input);
		expect(courts.locations.map((l) => [l.slug, l.access, l.indoor])).toEqual([
			['california-park', 'free', false],
			['mcfetridge-sports-center', 'reservation', true]
		]);
		expect(report).not.toContain('remove the addition');
		expect(CourtsSeed.safeParse(courts).success).toBe(true);
	});

	it('owner-verified removal overrides OSM and reports the dropped sites', () => {
		const input = base();
		input.pitches = [pitch(1, 41.92, -87.65)];
		input.cpdCourts = [{ park: 'OZ', parkNo: 1, lat: 41.92, lng: -87.65 }];
		input.curation = {
			corrections: [],
			additions: [],
			removed: [
				{ cpdParkNo: 1, park: 'Oz', note: 'Gone?', verifiedAt: '2026-10-25', verifiedBy: 'x' }
			]
		};
		const { courts, report } = buildCourtsSeed(input);
		expect(courts.locations).toHaveLength(0);
		expect(report).toContain('dropped OSM site Oz Park (1 court(s), way/1): consider updating OSM');
	});

	it('applies field corrections from verified sources and reports them', () => {
		const input = base();
		input.pitches = [pitch(1, 41.92, -87.65)];
		input.cpdCourts = [{ park: 'OZ', parkNo: 1, lat: 41.92, lng: -87.65 }];
		input.curation = {
			additions: [],
			removed: [],
			corrections: [
				{
					slug: 'oz-park',
					lights: true,
					note: 'Park page says lit.',
					sourceUrl: 'https://example.org/oz',
					verifiedAt: '2026-10-25',
					verifiedBy: 'owner'
				},
				{
					slug: 'nope',
					lights: true,
					note: 'x',
					sourceUrl: 'https://example.org',
					verifiedAt: '2026-10-25',
					verifiedBy: 'owner'
				}
			]
		};
		const { courts, report } = buildCourtsSeed(input);
		expect(courts.locations[0]).toMatchObject({ lights: true, verifiedAt: '2026-10-25' });
		expect(report).toContain('- Oz Park: lights null → true. Park page says lit.');
		expect(report).toContain('correction nope: no such location');
	});

	it('names a site after the OSM tennis area holding most of its courts', () => {
		const input = base();
		input.pitches = [pitch(1, 41.92, -87.65), pitch(2, 41.9201, -87.65), pitch(3, 41.9202, -87.65)];
		input.cpdCourts = [{ park: 'LINCOLN', parkNo: 1, lat: 41.92, lng: -87.65 }];
		input.parks = [
			{ id: 'way/9', name: 'Lincoln (Abraham) Park', polygons: [square(41.92, -87.65, 0.01)] }
		];
		const area = (name: string, lat: number) => ({
			id: name,
			name,
			polygons: [square(lat, -87.65, 0.00004)]
		});
		input.tennisAreas = [
			area('Waveland Park Tennis Courts', 41.92),
			area('Waveland Park Tennis Courts', 41.9201)
		];
		expect(buildCourtsSeed(input).courts.locations[0]).toMatchObject({
			slug: 'waveland-park-tennis-courts',
			name: 'Waveland Park Tennis Courts'
		});

		// One court of three inside a named area is not enough: the park name stays.
		input.tennisAreas = [area('Corner Courts', 41.9202)];
		expect(buildCourtsSeed(input).courts.locations[0].name).toBe('Lincoln Park');
	});

	it('renames a site to its own name, and its slug follows', () => {
		const input = base();
		input.pitches = [pitch(1, 41.92, -87.65)];
		input.cpdCourts = [{ park: 'OZ', parkNo: 1, lat: 41.92, lng: -87.65 }];
		input.curation = {
			additions: [],
			removed: [],
			corrections: [
				{
					slug: 'oz-park',
					name: 'Oz Park Tennis Center',
					note: 'Named in OSM.',
					sourceUrl: 'https://www.openstreetmap.org/way/1',
					verifiedAt: '2026-10-26',
					verifiedBy: 'owner'
				}
			]
		};
		const { courts, report } = buildCourtsSeed(input);
		expect(courts.locations[0]).toMatchObject({
			slug: 'oz-park-tennis-center',
			name: 'Oz Park Tennis Center'
		});
		expect(report).toContain('- Oz Park Tennis Center: name Oz Park → Oz Park Tennis Center.');
		expect(CourtsSeed.safeParse(courts).success).toBe(true);
	});

	it('builds valid community area and ZIP centroids', () => {
		const { areas } = buildCourtsSeed(base());
		expect(areas.communityAreas).toEqual([
			{ slug: 'lincoln-park', name: 'Lincoln Park', lat: 41.92, lng: -87.65 }
		]);
		expect(areas.zips).toEqual([{ zip: '60614', lat: 41.92, lng: -87.65 }]);
		expect(AreasSeed.safeParse(areas).success).toBe(true);
	});
});
