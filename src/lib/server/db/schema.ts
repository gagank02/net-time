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
	timestamp,
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
		// 'free' = first come, first served; 'reservation' = book (and usually pay) ahead at bookingUrl.
		access: text('access').notNull().default('free'),
		bookingUrl: text('booking_url'),
		/** Where non-default hours came from; null = Park District Code default (6 AM–11 PM). */
		hoursSourceUrl: text('hours_source_url'),
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
		check('court_locations_surface', sql`${t.surface} in ('hard', 'clay', 'grass', 'other')`),
		check('court_locations_access', sql`${t.access} in ('free', 'reservation', 'fee')`),
		check(
			'court_locations_hours_source_url',
			sql`${t.hoursSourceUrl} is null or ${t.hoursSourceUrl} like 'https://%'`
		),
		check(
			'court_locations_booking_url',
			sql`${t.bookingUrl} is null or ${t.bookingUrl} like 'https://%'`
		)
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

// Anonymous corrections (SPEC-submissions). Visitors' reports wait here for the owner's review;
// nothing in these tables is ever shown on the site. No name, email, IP or user agent, ever.
// The app role may only add reports and count pending ones (see the migration's grants).
export const correctionTopics = [
	'hours',
	'class',
	'surface',
	'lights',
	'court_count',
	'access',
	'name',
	'closed',
	'other'
] as const;

export const corrections = pgTable(
	'corrections',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		// Checked against the built court list by the app: court data lives in data/*.json, not here.
		courtSlug: text('court_slug').notNull(),
		// One report can cover several things (e.g. hours and lights).
		topics: text('topics', { enum: correctionTopics }).array().notNull(),
		details: text('details').notNull(),
		seenOn: date('seen_on'),
		status: text('status', { enum: ['pending', 'applied', 'rejected'] })
			.notNull()
			.default('pending'),
		// HMAC of court, topic, details and the Chicago date: drops same-day repeats without the app
		// ever reading report text.
		dedupeKey: text('dedupe_key').notNull().unique(),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		reviewedAt: timestamp('reviewed_at', { withTimezone: true })
	},
	(t) => [
		index('corrections_status').on(t.status, t.createdAt),
		check('corrections_court_slug', sql`${t.courtSlug} ~ '^[a-z0-9-]{1,80}$'`),
		check(
			'corrections_topics',
			sql`cardinality(${t.topics}) between 1 and 9 and ${t.topics} <@ array['hours', 'class', 'surface', 'lights', 'court_count', 'access', 'name', 'closed', 'other']`
		),
		check('corrections_details', sql`char_length(${t.details}) between 1 and 1000`),
		check('corrections_status', sql`${t.status} in ('pending', 'applied', 'rejected')`),
		check('corrections_reviewed', sql`(${t.status} = 'pending') = (${t.reviewedAt} is null)`)
	]
);

// Per-network daily counter. `key` is an HMAC of the IP and the Chicago date (never the IP), so
// keys can't be linked across days; rows from earlier days are deleted as new ones arrive.
export const correctionLimits = pgTable(
	'correction_limits',
	{
		key: text('key').primaryKey(),
		day: date('day').notNull(),
		count: smallint('count').notNull().default(1)
	},
	(t) => [index('correction_limits_day').on(t.day)]
);

// One row: when the owner was last pinged about new reports (Discord). The app may only move it
// forward once an hour has passed, so a burst of reports sends one notification, not many.
export const correctionNotices = pgTable(
	'correction_notices',
	{
		id: smallint('id').primaryKey(),
		sentAt: timestamp('sent_at', { withTimezone: true }).notNull()
	},
	(t) => [check('correction_notices_single', sql`${t.id} = 1`)]
);
