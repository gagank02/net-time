import { sql } from 'drizzle-orm';
import {
	boolean,
	check,
	date,
	geometry,
	index,
	integer,
	pgTable,
	smallint,
	text,
	time,
	uuid
} from 'drizzle-orm/pg-core';

// Courts (read-only for the app role: see the courts migration's REVOKE).
// Times are America/Chicago wall-clock times, as the Park District publishes them.

const point = (name: string) => geometry(name, { type: 'point', mode: 'xy', srid: 4326 });

export const courtLocations = pgTable(
	'court_locations',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		slug: text('slug').notNull().unique(),
		name: text('name').notNull(),
		address: text('address'),
		location: point('location').notNull(),
		courtCount: smallint('court_count').notNull(),
		lights: boolean('lights'),
		surface: text('surface'),
		indoor: boolean('indoor').notNull().default(false),
		communityArea: text('community_area').notNull(),
		cpdParkNo: integer('cpd_park_no'),
		osmIds: text('osm_ids')
			.array()
			.notNull()
			.default(sql`'{}'::text[]`),
		verifiedAt: date('verified_at').notNull()
	},
	(t) => [
		check('court_locations_slug', sql`${t.slug} ~ '^[a-z0-9-]{1,80}$'`),
		check('court_locations_name', sql`char_length(${t.name}) between 1 and 120`),
		check('court_locations_court_count', sql`${t.courtCount} between 1 and 40`),
		check('court_locations_surface', sql`${t.surface} in ('hard', 'clay', 'grass', 'other')`)
	]
);

export const locationHours = pgTable(
	'location_hours',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		locationId: uuid('location_id')
			.notNull()
			.references(() => courtLocations.id, { onDelete: 'cascade' }),
		weekday: smallint('weekday').notNull(),
		opens: time('opens').notNull(),
		closes: time('closes').notNull(),
		seasonStart: date('season_start'),
		seasonEnd: date('season_end')
	},
	(t) => [
		index('location_hours_location').on(t.locationId),
		check('location_hours_weekday', sql`${t.weekday} between 0 and 6`),
		check('location_hours_order', sql`${t.closes} > ${t.opens}`),
		check(
			'location_hours_season',
			sql`(${t.seasonStart} is null) = (${t.seasonEnd} is null) and (${t.seasonEnd} is null or ${t.seasonEnd} >= ${t.seasonStart})`
		)
	]
);

export const classBlocks = pgTable(
	'class_blocks',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		locationId: uuid('location_id')
			.notNull()
			.references(() => courtLocations.id, { onDelete: 'cascade' }),
		title: text('title').notNull(),
		weekday: smallint('weekday').notNull(),
		starts: time('starts').notNull(),
		ends: time('ends').notNull(),
		courtsUsed: smallint('courts_used').notNull(),
		seasonStart: date('season_start').notNull(),
		seasonEnd: date('season_end').notNull(),
		sourceUrl: text('source_url').notNull(),
		verifiedAt: date('verified_at').notNull()
	},
	(t) => [
		index('class_blocks_location').on(t.locationId),
		check('class_blocks_title', sql`char_length(${t.title}) between 1 and 120`),
		check('class_blocks_weekday', sql`${t.weekday} between 0 and 6`),
		check('class_blocks_order', sql`${t.ends} > ${t.starts}`),
		check('class_blocks_courts', sql`${t.courtsUsed} between 1 and 40`),
		check('class_blocks_season', sql`${t.seasonEnd} >= ${t.seasonStart}`),
		check('class_blocks_source', sql`${t.sourceUrl} like 'https://%'`)
	]
);

export const communityAreas = pgTable(
	'community_areas',
	{
		slug: text('slug').primaryKey(),
		name: text('name').notNull().unique(),
		centroid: point('centroid').notNull()
	},
	(t) => [check('community_areas_slug', sql`${t.slug} ~ '^[a-z0-9-]{1,80}$'`)]
);

export const zipCodes = pgTable(
	'zip_codes',
	{
		zip: text('zip').primaryKey(),
		centroid: point('centroid').notNull()
	},
	(t) => [check('zip_codes_zip', sql`${t.zip} ~ '^[0-9]{5}$'`)]
);
