ALTER TABLE "court_locations" ADD COLUMN "access" text DEFAULT 'free' NOT NULL;--> statement-breakpoint
ALTER TABLE "court_locations" ADD COLUMN "booking_url" text;--> statement-breakpoint
ALTER TABLE "court_locations" ADD CONSTRAINT "court_locations_access" CHECK ("court_locations"."access" in ('free', 'reservation'));--> statement-breakpoint
ALTER TABLE "court_locations" ADD CONSTRAINT "court_locations_booking_url" CHECK ("court_locations"."booking_url" is null or "court_locations"."booking_url" like 'https://%');