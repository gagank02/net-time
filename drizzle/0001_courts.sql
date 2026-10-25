CREATE TABLE "class_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"location_id" uuid NOT NULL,
	"title" text NOT NULL,
	"weekday" smallint NOT NULL,
	"starts" time NOT NULL,
	"ends" time NOT NULL,
	"courts_used" smallint NOT NULL,
	"season_start" date NOT NULL,
	"season_end" date NOT NULL,
	"source_url" text NOT NULL,
	"verified_at" date NOT NULL,
	CONSTRAINT "class_blocks_title" CHECK (char_length("class_blocks"."title") between 1 and 120),
	CONSTRAINT "class_blocks_weekday" CHECK ("class_blocks"."weekday" between 0 and 6),
	CONSTRAINT "class_blocks_order" CHECK ("class_blocks"."ends" > "class_blocks"."starts"),
	CONSTRAINT "class_blocks_courts" CHECK ("class_blocks"."courts_used" between 1 and 40),
	CONSTRAINT "class_blocks_season" CHECK ("class_blocks"."season_end" >= "class_blocks"."season_start"),
	CONSTRAINT "class_blocks_source" CHECK ("class_blocks"."source_url" like 'https://%')
);
--> statement-breakpoint
CREATE TABLE "community_areas" (
	"slug" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"centroid" geometry(point, 4326) NOT NULL,
	CONSTRAINT "community_areas_name_unique" UNIQUE("name"),
	CONSTRAINT "community_areas_slug" CHECK ("community_areas"."slug" ~ '^[a-z0-9-]{1,80}$')
);
--> statement-breakpoint
CREATE TABLE "court_locations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"location" geometry(point, 4326) NOT NULL,
	"court_count" smallint NOT NULL,
	"lights" boolean,
	"surface" text,
	"indoor" boolean DEFAULT false NOT NULL,
	"community_area" text NOT NULL,
	"cpd_park_no" integer,
	"osm_ids" text[] DEFAULT '{}'::text[] NOT NULL,
	"verified_at" date NOT NULL,
	CONSTRAINT "court_locations_slug_unique" UNIQUE("slug"),
	CONSTRAINT "court_locations_slug" CHECK ("court_locations"."slug" ~ '^[a-z0-9-]{1,80}$'),
	CONSTRAINT "court_locations_name" CHECK (char_length("court_locations"."name") between 1 and 120),
	CONSTRAINT "court_locations_court_count" CHECK ("court_locations"."court_count" between 1 and 40),
	CONSTRAINT "court_locations_surface" CHECK ("court_locations"."surface" in ('hard', 'clay', 'grass', 'other'))
);
--> statement-breakpoint
CREATE TABLE "location_hours" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"location_id" uuid NOT NULL,
	"weekday" smallint NOT NULL,
	"opens" time NOT NULL,
	"closes" time NOT NULL,
	"season_start" date,
	"season_end" date,
	CONSTRAINT "location_hours_weekday" CHECK ("location_hours"."weekday" between 0 and 6),
	CONSTRAINT "location_hours_order" CHECK ("location_hours"."closes" > "location_hours"."opens"),
	CONSTRAINT "location_hours_season" CHECK (("location_hours"."season_start" is null) = ("location_hours"."season_end" is null) and ("location_hours"."season_end" is null or "location_hours"."season_end" >= "location_hours"."season_start"))
);
--> statement-breakpoint
CREATE TABLE "zip_codes" (
	"zip" text PRIMARY KEY NOT NULL,
	"centroid" geometry(point, 4326) NOT NULL,
	CONSTRAINT "zip_codes_zip" CHECK ("zip_codes"."zip" ~ '^[0-9]{5}$')
);
--> statement-breakpoint
ALTER TABLE "class_blocks" ADD CONSTRAINT "class_blocks_location_id_court_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."court_locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "location_hours" ADD CONSTRAINT "location_hours_location_id_court_locations_id_fk" FOREIGN KEY ("location_id") REFERENCES "public"."court_locations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "class_blocks_location" ON "class_blocks" USING btree ("location_id");--> statement-breakpoint
CREATE INDEX "location_hours_location" ON "location_hours" USING btree ("location_id");--> statement-breakpoint
-- Court data is read-only for the app: only the owner role (seed script, later submissions approvals) writes.
-- Default privileges from 0000 granted DML on new tables; take writes back explicitly.
REVOKE INSERT, UPDATE, DELETE ON "court_locations", "location_hours", "class_blocks", "community_areas", "zip_codes" FROM net_time_app;
