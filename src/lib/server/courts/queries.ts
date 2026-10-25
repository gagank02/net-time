import { sql } from 'drizzle-orm';
import { withDb } from '#lib/server/db/client.js';
import type { CourtListItem } from '#lib/courts/types.js';

/**
 * Every court location with its hours and not-yet-ended classes, in ONE query (JSON aggregation).
 * `today` is the Chicago date (YYYY-MM-DD) so past seasons are left out.
 */
export function listCourts(today: string): Promise<CourtListItem[]> {
	return withDb(async (db) => {
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
			order by l.name
		`);
		return rows as CourtListItem[];
	});
}
