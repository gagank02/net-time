import { defineConfig } from 'drizzle-kit';

export default defineConfig({
	dialect: 'postgresql',
	schema: './src/lib/server/db/schema.ts',
	out: './drizzle',
	// Owner role: migrations only. Never deployed to the Worker.
	dbCredentials: {
		url: process.env.MIGRATION_DATABASE_URL ?? 'postgres://net_time_owner@localhost:5432/net_time'
	},
	extensionsFilters: ['postgis'],
	strict: true
});
