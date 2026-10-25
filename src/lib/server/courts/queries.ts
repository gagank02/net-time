import { sql } from 'drizzle-orm';
import { cached } from '#lib/server/cache.js';
import { withDb } from '#lib/server/db/client.js';
import type { Area, CourtDetail, CourtListItem, Zip } from '#lib/courts/types.js';

// Court data changes only on re-seed, so an hour stale is fine; keyed by Chicago date so a new
// day drops ended class seasons. Matches the Hyperdrive config's max_age (3600 s).
const dataTtl = 3600;

export type CourtsPage = { courts: CourtListItem[]; areas: Area[]; zips: Zip[] };

/**
 * Everything /courts needs in ONE query (JSON aggregation): every court location with its hours and
 * not-yet-ended classes, plus community-area and ZIP centroids for on-device "near me".
 * `today` is the Chicago date (YYYY-MM-DD) so past seasons are left out.
 */
export function listCourts(today: string): Promise<CourtsPage> {
	return cached(`courts/${today}`, dataTtl, () =>
		withDb(async (db) => {
			const { rows } = await db.execute(sql`
			select
			(select coalesce(json_agg(c order by c.name), '[]'::json) from (
			select
				l.slug,
				l.name,
				st_y(l.location) as lat,
				st_x(l.location) as lng,
				l.court_count as "courtCount",
				l.lights,
				l.surface,
				l.indoor,
				l.access,
				l.booking_url as "bookingUrl",
				l.community_area as "communityArea",
				coalesce((
					select json_agg(json_build_object(
						'weekday', h.weekday,
						'opens', to_char(h.opens, 'HH24:MI'),
						'closes', to_char(h.closes, 'HH24:MI'),
						'seasonStart', h.season_start::text,
						'seasonEnd', h.season_end::text
					) order by h.weekday, h.opens)
					from location_hours h
					where h.location_id = l.id
						and (h.season_end is null or h.season_end >= ${today}::date)
				), '[]'::json) as hours,
				coalesce((
					select json_agg(json_build_object(
						'title', c.title,
						'weekday', c.weekday,
						'starts', to_char(c.starts, 'HH24:MI'),
						'ends', to_char(c.ends, 'HH24:MI'),
						'courtsUsed', c.courts_used,
						'seasonStart', c.season_start::text,
						'seasonEnd', c.season_end::text
					) order by c.weekday, c.starts)
					from class_blocks c
					where c.location_id = l.id and c.season_end >= ${today}::date
				), '[]'::json) as classes
			from court_locations l
			) c) as courts,
			(select coalesce(json_agg(json_build_object(
				'slug', a.slug, 'name', a.name, 'lat', st_y(a.centroid), 'lng', st_x(a.centroid)
			) order by a.name), '[]'::json) from community_areas a) as areas,
			(select coalesce(json_agg(json_build_object(
				'zip', z.zip, 'lat', st_y(z.centroid), 'lng', st_x(z.centroid)
			) order by z.zip), '[]'::json) from zip_codes z) as zips
		`);
			return rows[0] as CourtsPage;
		})
	);
}

export const slugPattern = /^[a-z0-9-]{1,80}$/;

/** One court with everything the detail page shows, or null. Caller validates the slug first. */
export function getCourt(slug: string, today: string): Promise<CourtDetail | null> {
	return cached(`court/${slug}/${today}`, dataTtl, () =>
		withDb(async (db) => {
			const { rows } = await db.execute(sql`
			select
				l.slug,
				l.name,
				st_y(l.location) as lat,
				st_x(l.location) as lng,
				l.court_count as "courtCount",
				l.lights,
				l.surface,
				l.indoor,
				l.access,
				l.booking_url as "bookingUrl",
				l.hours_source_url as "hoursSourceUrl",
				l.community_area as "communityArea",
				l.address,
				l.osm_ids as "osmIds",
				l.verified_at::text as "verifiedAt",
				coalesce((
					select json_agg(json_build_object(
						'weekday', h.weekday,
						'opens', to_char(h.opens, 'HH24:MI'),
						'closes', to_char(h.closes, 'HH24:MI'),
						'seasonStart', h.season_start::text,
						'seasonEnd', h.season_end::text
					) order by h.weekday, h.opens)
					from location_hours h
					where h.location_id = l.id
						and (h.season_end is null or h.season_end >= ${today}::date)
				), '[]'::json) as hours,
				coalesce((
					select json_agg(json_build_object(
						'title', c.title,
						'weekday', c.weekday,
						'starts', to_char(c.starts, 'HH24:MI'),
						'ends', to_char(c.ends, 'HH24:MI'),
						'courtsUsed', c.courts_used,
						'seasonStart', c.season_start::text,
						'seasonEnd', c.season_end::text,
						'sourceUrl', c.source_url,
						'verifiedAt', c.verified_at::text
					) order by c.weekday, c.starts)
					from class_blocks c
					where c.location_id = l.id and c.season_end >= ${today}::date
				), '[]'::json) as classes
			from court_locations l
			where l.slug = ${slug}
		`);
			return (rows[0] as CourtDetail | undefined) ?? null;
		})
	);
}
