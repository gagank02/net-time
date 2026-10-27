// Zod schemas for data/*.seed.json. Seeds come from third parties (OSM, City of Chicago) and hand
// entry, so they are untrusted input: strict objects (typos fail), bounded strings, no control
// characters, coordinates inside Chicago. The DB has matching CHECK constraints as a second layer.
import { z } from 'zod';

const slug = z
	.string()
	.regex(/^[a-z0-9-]{1,80}$/, 'slug must be lowercase letters, digits, hyphens');
const safeText = (max: number) =>
	z
		.string()
		.trim()
		.min(1)
		.max(max)
		// eslint-disable-next-line no-control-regex -- intentionally matching control characters
		.refine((s) => !/[\u0000-\u001f\u007f]/.test(s), 'contains control characters');
// Chicago city limits sit inside this box (41.64–42.03 N, 87.52–87.94 W), padded slightly.
const lat = z.number().min(41.6).max(42.1);
const lng = z.number().min(-88).max(-87.5);
const isoDate = z.iso.date();
const clock = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'time must be HH:MM (24h)');
const weekday = z.int().min(0).max(6);
const httpsUrl = z.url({ protocol: /^https$/ }).max(500);

export const CourtLocationSeed = z.strictObject({
	slug,
	name: safeText(120),
	address: safeText(200).nullable(),
	lat,
	lng,
	courtCount: z.int().min(1).max(40),
	lights: z.boolean().nullable(),
	surface: z.enum(['hard', 'clay', 'grass', 'other']).nullable(),
	indoor: z.boolean(),
	access: z.enum(['free', 'reservation', 'fee']),
	bookingUrl: httpsUrl.nullable(),
	communityArea: safeText(80),
	cpdParkNo: z.int().positive().nullable(),
	osmIds: z.array(z.string().regex(/^(node|way|relation)\/\d+$/)).max(50),
	verifiedAt: isoDate
});

const uniqueBy =
	<T>(key: (item: T) => string, label: string) =>
	(items: T[], ctx: z.RefinementCtx) => {
		const seen = new Set<string>();
		for (const item of items) {
			const k = key(item);
			if (seen.has(k)) ctx.addIssue({ code: 'custom', message: `duplicate ${label}: ${k}` });
			seen.add(k);
		}
	};

export const CourtsSeed = z.strictObject({
	generatedAt: z.iso.datetime(),
	locations: z
		.array(CourtLocationSeed)
		.max(1000)
		.superRefine(uniqueBy((l) => l.slug, 'slug'))
});

export const AreasSeed = z.strictObject({
	communityAreas: z
		.array(z.strictObject({ slug, name: safeText(80), lat, lng }))
		.max(100)
		.superRefine(uniqueBy((a) => a.slug, 'community area')),
	zips: z
		.array(z.strictObject({ zip: z.string().regex(/^\d{5}$/), lat, lng }))
		.max(100)
		.superRefine(uniqueBy((z) => z.zip, 'zip'))
});

const season = {
	seasonStart: isoDate,
	seasonEnd: isoDate
};

const ordered = <T extends { opens?: string; closes?: string; starts?: string; ends?: string }>(
	v: T
) =>
	(v.opens && v.closes ? v.closes > v.opens : true) &&
	(v.starts && v.ends ? v.ends > v.starts : true);

const seasonOrdered = (v: { seasonStart?: string; seasonEnd?: string }) =>
	(v.seasonStart === undefined) === (v.seasonEnd === undefined) &&
	(!v.seasonStart || !v.seasonEnd || v.seasonEnd >= v.seasonStart);

export const HoursSeed = z
	.strictObject({
		weekday,
		opens: clock,
		closes: clock,
		seasonStart: isoDate.optional(),
		seasonEnd: isoDate.optional()
	})
	.refine(ordered, 'closes must be after opens')
	.refine(seasonOrdered, 'season needs both start and end, end ≥ start');

export const HoursOverridesSeed = z.strictObject({
	overrides: z
		.array(
			z.strictObject({
				slug,
				hours: z.array(HoursSeed).min(1).max(28),
				/** Seasonal courts: shown when closed outside every season, e.g. "open mid-May to mid-October". */
				seasonNote: safeText(80).optional(),
				sourceUrl: httpsUrl,
				verifiedAt: isoDate
			})
		)
		.superRefine(uniqueBy((o) => o.slug, 'override slug'))
});

export const ClassesSeed = z.strictObject({
	classes: z.array(
		z
			.strictObject({
				location: slug,
				title: safeText(120),
				weekday,
				starts: clock,
				ends: clock,
				courtsUsed: z.int().min(1).max(40),
				...season,
				sourceUrl: httpsUrl,
				verifiedAt: isoDate
			})
			.refine(ordered, 'ends must be after starts')
			.refine(seasonOrdered, 'seasonEnd must be ≥ seasonStart')
	)
});

/** Park District Code default when a park has no override: 6 AM–11 PM, every day. */
export const defaultHours: z.infer<typeof HoursSeed>[] = Array.from(
	{ length: 7 },
	(_, weekday) => ({
		weekday,
		opens: '06:00',
		closes: '23:00'
	})
);

/**
 * Human corrections applied by build-courts-seed (data/courts.curation.json): courts missing from
 * OSM, and 2016 CPD tennis parks confirmed to have no courts any more. Each entry records who
 * verified it and when, so a later --refresh keeps the corrections and their provenance.
 */
export const CurationSeed = z.strictObject({
	additions: z.array(
		z
			.strictObject({
				slug,
				name: safeText(120),
				cpdParkNo: z.int().positive(),
				/** Set for a separate site (e.g. an indoor center); omit to place at the park's CPD tennis points. */
				lat: lat.optional(),
				lng: lng.optional(),
				access: z.enum(['free', 'reservation', 'fee']).default('free'),
				bookingUrl: httpsUrl.nullable().default(null),
				courtCount: z.int().min(1).max(40),
				lights: z.boolean().nullable(),
				surface: z.enum(['hard', 'clay', 'grass', 'other']).nullable(),
				indoor: z.boolean(),
				note: safeText(300),
				sourceUrl: httpsUrl.optional(),
				verifiedAt: isoDate,
				verifiedBy: safeText(80)
			})
			.refine((a) => (a.lat === undefined) === (a.lng === undefined), 'lat and lng go together')
	),
	corrections: z.array(
		z
			.strictObject({
				slug,
				/** The courts' own name where OSM or the park names them; the slug follows it. */
				name: safeText(120).optional(),
				lights: z.boolean().optional(),
				surface: z.enum(['hard', 'clay', 'grass', 'other']).optional(),
				courtCount: z.int().min(1).max(40).optional(),
				indoor: z.boolean().optional(),
				access: z.enum(['free', 'reservation', 'fee']).optional(),
				note: safeText(300),
				sourceUrl: httpsUrl,
				verifiedAt: isoDate,
				verifiedBy: safeText(80)
			})
			.refine(
				(c) => ['name', 'lights', 'surface', 'courtCount', 'indoor', 'access'].some((k) => k in c),
				'a correction must change at least one field'
			)
	),
	removed: z.array(
		z.strictObject({
			cpdParkNo: z.int().positive(),
			park: safeText(120),
			note: safeText(300),
			verifiedAt: isoDate,
			verifiedBy: safeText(80)
		})
	)
});
