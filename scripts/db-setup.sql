-- Local dev only: creates the net_time database and its two roles. Idempotent.
-- Run as a Postgres superuser: npm run db:setup
-- Neon (prod) roles are created in the Neon console at go-live; grants live in migrations.
--
-- No passwords: Homebrew Postgres trusts localhost connections. Never reuse this on a shared host.

SELECT 'CREATE ROLE net_time_owner LOGIN'
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'net_time_owner')\gexec

SELECT 'CREATE ROLE net_time_app LOGIN'
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'net_time_app')\gexec

SELECT 'CREATE DATABASE net_time OWNER net_time_owner'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'net_time')\gexec

\connect net_time

-- PostGIS isn't a trusted extension, so a superuser must create it (Neon's owner role can).
CREATE EXTENSION IF NOT EXISTS postgis;
ALTER SCHEMA public OWNER TO net_time_owner;
