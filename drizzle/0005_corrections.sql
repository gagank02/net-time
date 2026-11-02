CREATE TABLE "correction_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"day" date NOT NULL,
	"count" smallint DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "correction_notices" (
	"id" smallint PRIMARY KEY NOT NULL,
	"sent_at" timestamp with time zone NOT NULL,
	CONSTRAINT "correction_notices_single" CHECK ("correction_notices"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE "corrections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"court_slug" text NOT NULL,
	"topics" text[] NOT NULL,
	"details" text NOT NULL,
	"seen_on" date,
	"status" text DEFAULT 'pending' NOT NULL,
	"dedupe_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone,
	CONSTRAINT "corrections_dedupe_key_unique" UNIQUE("dedupe_key"),
	CONSTRAINT "corrections_court_slug" CHECK ("corrections"."court_slug" ~ '^[a-z0-9-]{1,80}$'),
	CONSTRAINT "corrections_topics" CHECK (cardinality("corrections"."topics") between 1 and 9 and "corrections"."topics" <@ array['hours', 'class', 'surface', 'lights', 'court_count', 'access', 'name', 'closed', 'other']),
	CONSTRAINT "corrections_details" CHECK (char_length("corrections"."details") between 1 and 1000),
	CONSTRAINT "corrections_status" CHECK ("corrections"."status" in ('pending', 'applied', 'rejected')),
	CONSTRAINT "corrections_reviewed" CHECK (("corrections"."status" = 'pending') = ("corrections"."reviewed_at" is null))
);
--> statement-breakpoint
CREATE INDEX "correction_limits_day" ON "correction_limits" USING btree ("day");--> statement-breakpoint
CREATE INDEX "corrections_status" ON "corrections" USING btree ("status","created_at");--> statement-breakpoint
-- Least privilege: the Worker can add a report and count pending ones (status), and check same-day
-- repeats (dedupe_key), but never read report text, change or delete reports. Only the owner role
-- (npm run corrections:review) reads, reviews and deletes. Default privileges from 0000 granted
-- full DML on new tables; take it back first.
REVOKE ALL ON "corrections", "correction_limits" FROM net_time_app;--> statement-breakpoint
GRANT INSERT ("court_slug", "topics", "details", "seen_on", "dedupe_key") ON "corrections" TO net_time_app;--> statement-breakpoint
GRANT SELECT ("status", "dedupe_key") ON "corrections" TO net_time_app;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "correction_limits" TO net_time_app;
--> statement-breakpoint
-- Retention (see /privacy), enforced by the database rather than by anyone remembering: reviewed
-- reports go 30 days after review, unreviewed ones after 180 days, rate-limit codes after their
-- day. SECURITY DEFINER runs it as the owner, so the app role can trigger it (on each new report)
-- without holding DELETE itself; it can only ever remove rows past these windows.
CREATE FUNCTION purge_old_corrections() RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
	DELETE FROM corrections
	WHERE (status <> 'pending' AND reviewed_at < now() - interval '30 days')
		OR (status = 'pending' AND created_at < now() - interval '180 days');
	DELETE FROM correction_limits WHERE day < (now() AT TIME ZONE 'America/Chicago')::date;
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION purge_old_corrections() FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION purge_old_corrections() TO net_time_app;--> statement-breakpoint
REVOKE DELETE ON "correction_limits" FROM net_time_app;
--> statement-breakpoint
-- The notice row starts in the past so the first report notifies. The app can read it and move it
-- forward (the hour check is in its UPDATE), nothing else.
INSERT INTO "correction_notices" ("id", "sent_at") VALUES (1, 'epoch');--> statement-breakpoint
REVOKE ALL ON "correction_notices" FROM net_time_app;--> statement-breakpoint
GRANT SELECT, UPDATE ("sent_at") ON "correction_notices" TO net_time_app;
