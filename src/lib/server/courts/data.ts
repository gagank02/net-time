// Court page data, built at prerender time from the committed seed files (see SPEC-courts
// Revision 1). Nothing here runs per request: /courts and /courts/[slug] ship as static files.
// The seeds are third-party data, so they're Zod-validated here too; a bad file fails the build.
import classesJson from '../../../../data/classes.seed.json';
import areasJson from '../../../../data/areas.seed.json';
import courtsJson from '../../../../data/courts.seed.json';
import overridesJson from '../../../../data/hours.overrides.json';
import {
	AreasSeed,
	ClassesSeed,
	CourtsSeed,
	defaultHours,
	HoursOverridesSeed
} from '../../../../scripts/seed-schema.ts';
import type {
	Area,
	ClassDetail,
	CourtDetail,
	CourtListItem,
	HoursRow,
	Zip
} from '#lib/courts/types.js';

export type CourtsPage = { courts: CourtListItem[]; areas: Area[]; zips: Zip[] };

const courtsSeed = CourtsSeed.parse(courtsJson);
const areasSeed = AreasSeed.parse(areasJson);
const overrides = HoursOverridesSeed.parse(overridesJson).overrides;
const classes = ClassesSeed.parse(classesJson).classes;

const bySlug = new Map(courtsSeed.locations.map((l) => [l.slug, l]));
const unknown = [...overrides.map((o) => o.slug), ...classes.map((c) => c.location)].filter(
	(s) => !bySlug.has(s)
);
if (unknown.length) throw new Error(`overrides/classes reference unknown locations: ${unknown}`);

const overrideBySlug = new Map(overrides.map((o) => [o.slug, o]));

/** Every slug with a page; drives the prerender entries. */
export const courtSlugs = courtsSeed.locations.map((l) => l.slug);

/** Hours in effect on or after `today` (Chicago date), weekday then opening time. */
function hoursFor(slug: string, today: string): HoursRow[] {
	return (overrideBySlug.get(slug)?.hours ?? defaultHours)
		.filter((h) => !h.seasonEnd || h.seasonEnd >= today)
		.map((h) => ({
			weekday: h.weekday,
			opens: h.opens,
			closes: h.closes,
			seasonStart: h.seasonStart ?? null,
			seasonEnd: h.seasonEnd ?? null
		}))
		.sort((a, b) => a.weekday - b.weekday || a.opens.localeCompare(b.opens));
}

/** Classes not yet ended on `today`, weekday then start time. */
function classesFor(slug: string, today: string): ClassDetail[] {
	return classes
		.filter((c) => c.location === slug && c.seasonEnd >= today)
		.map((c) => ({
			title: c.title,
			weekday: c.weekday,
			starts: c.starts,
			ends: c.ends,
			courtsUsed: c.courtsUsed,
			seasonStart: c.seasonStart,
			seasonEnd: c.seasonEnd,
			sourceUrl: c.sourceUrl,
			verifiedAt: c.verifiedAt
		}))
		.sort((a, b) => a.weekday - b.weekday || a.starts.localeCompare(b.starts));
}

function listItem(l: (typeof courtsSeed.locations)[number], today: string): CourtListItem {
	return {
		slug: l.slug,
		name: l.name,
		lat: l.lat,
		lng: l.lng,
		courtCount: l.courtCount,
		lights: l.lights,
		surface: l.surface,
		indoor: l.indoor,
		access: l.access,
		bookingUrl: l.bookingUrl,
		communityArea: l.communityArea,
		hours: hoursFor(l.slug, today),
		seasonNote: overrideBySlug.get(l.slug)?.seasonNote ?? null,
		// The list needs only what status uses; sources and dates stay on the detail page.
		classes: classesFor(l.slug, today).map((c) => ({
			title: c.title,
			weekday: c.weekday,
			starts: c.starts,
			ends: c.ends,
			courtsUsed: c.courtsUsed,
			seasonStart: c.seasonStart,
			seasonEnd: c.seasonEnd
		}))
	};
}

/** Everything /courts needs: every location plus area and ZIP centroids for on-device sorting. */
export function listCourts(today: string): CourtsPage {
	return {
		courts: courtsSeed.locations
			.map((l) => listItem(l, today))
			.sort((a, b) => a.name.localeCompare(b.name, 'en')),
		areas: [...areasSeed.communityAreas].sort((a, b) => a.name.localeCompare(b.name, 'en')),
		zips: [...areasSeed.zips].sort((a, b) => a.zip.localeCompare(b.zip))
	};
}

/** One court with everything the detail page shows, or null for an unknown slug. */
export function getCourt(slug: string, today: string): CourtDetail | null {
	const l = bySlug.get(slug);
	if (!l) return null;
	return {
		...listItem(l, today),
		classes: classesFor(slug, today),
		address: l.address,
		osmIds: l.osmIds,
		verifiedAt: l.verifiedAt,
		hoursSourceUrl: overrideBySlug.get(slug)?.sourceUrl ?? null
	};
}
