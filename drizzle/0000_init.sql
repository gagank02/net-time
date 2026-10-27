-- PostGIS: already created by db-setup.sql locally (needs superuser); Neon's owner role can create it.
CREATE EXTENSION IF NOT EXISTS postgis;
--> statement-breakpoint
-- Least privilege: the app role may read/write rows in tables the owner creates, never change schema.
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO net_time_app;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO net_time_app;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO net_time_app;
