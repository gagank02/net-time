// Loads data/*.seed.json into Postgres as the owner role (the app role can't write court tables).
// Usage: npm run db:seed            (SEED_DIR=path to use another directory, e.g. test fixtures)
// Validates everything first, then replaces court data in one transaction: re-running converges
// to the same state, and a bad file changes nothing.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { notInArray, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { z } from 'zod';
import {
	classBlocks,
	communityAreas,
	courtLocations,
	locationHours,
	zipCodes
} from '../src/lib/server/db/schema.ts';
import {
	AreasSeed,
	ClassesSeed,
	CourtsSeed,
	defaultHours,
	HoursOverridesSeed
} from './seed-schema.ts';

const dir = process.env.SEED_DIR ?? 'data';
const url =
	process.env.MIGRATION_DATABASE_URL ?? 'postgres://net_time_owner@localhost:5432/net_time';

async function load<T>(file: string, schema: { parse: (v: unknown) => T }, fallback?: T) {
	try {
		return schema.parse(JSON.parse(await readFile(join(dir, file), 'utf8')));
	} catch (error) {
		if (fallback !== undefined && (error as NodeJS.ErrnoException).code === 'ENOENT')
			return fallback;
		const detail = error instanceof z.ZodError ? z.prettifyError(error) : (error as Error).message;
		throw new Error(`${join(dir, file)}:\n${detail}`, { cause: error });
	}
}

const pointSql = (lng: number, lat: number) => sql`ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)`;

const courts = await load('courts.seed.json', CourtsSeed);
const areas = await load('areas.seed.json', AreasSeed);
const overrides = await load('hours.overrides.json', HoursOverridesSeed, { overrides: [] });
const classes = await load('classes.seed.json', ClassesSeed, { classes: [] });

const slugs = new Set(courts.locations.map((l) => l.slug));
const unknown = [
	...overrides.overrides.map((o) => o.slug),
	...classes.classes.map((c) => c.location)
].filter((s) => !slugs.has(s));
if (unknown.length) throw new Error(`overrides/classes reference unknown locations: ${unknown}`);

const client = new pg.Client({ connectionString: url });
await client.connect();
const db = drizzle(client);

try {
	await db.transaction(async (tx) => {
		for (const a of areas.communityAreas) {
			const row = { slug: a.slug, name: a.name, centroid: pointSql(a.lng, a.lat) };
			await tx
				.insert(communityAreas)
				.values(row)
				.onConflictDoUpdate({ target: communityAreas.slug, set: row });
		}
		for (const z of areas.zips) {
			const row = { zip: z.zip, centroid: pointSql(z.lng, z.lat) };
			await tx.insert(zipCodes).values(row).onConflictDoUpdate({ target: zipCodes.zip, set: row });
		}

		const ids = new Map<string, string>();
		for (const l of courts.locations) {
			const row = {
				slug: l.slug,
				name: l.name,
				address: l.address,
				location: pointSql(l.lng, l.lat),
				courtCount: l.courtCount,
				lights: l.lights,
				surface: l.surface,
				indoor: l.indoor,
				access: l.access,
				bookingUrl: l.bookingUrl,
				communityArea: l.communityArea,
				cpdParkNo: l.cpdParkNo,
				osmIds: l.osmIds,
				verifiedAt: l.verifiedAt
			};
			const [saved] = await tx
				.insert(courtLocations)
				.values(row)
				.onConflictDoUpdate({ target: courtLocations.slug, set: row })
				.returning({ id: courtLocations.id });
			ids.set(l.slug, saved.id);
		}

		// Prune locations no longer in the seed (cascades to their hours and classes).
		await tx.delete(courtLocations).where(notInArray(courtLocations.slug, [...slugs]));

		// Hours and classes are fully derived from the seed files: replace them.
		await tx.delete(locationHours);
		await tx.delete(classBlocks);

		const overrideBySlug = new Map(overrides.overrides.map((o) => [o.slug, o.hours]));
		const hourRows = courts.locations.flatMap((l) =>
			(overrideBySlug.get(l.slug) ?? defaultHours).map((h) => ({
				locationId: ids.get(l.slug)!,
				weekday: h.weekday,
				opens: h.opens,
				closes: h.closes,
				seasonStart: h.seasonStart ?? null,
				seasonEnd: h.seasonEnd ?? null
			}))
		);
		if (hourRows.length) await tx.insert(locationHours).values(hourRows);

		const classRows = classes.classes.map((c) => ({
			locationId: ids.get(c.location)!,
			title: c.title,
			weekday: c.weekday,
			starts: c.starts,
			ends: c.ends,
			courtsUsed: c.courtsUsed,
			seasonStart: c.seasonStart,
			seasonEnd: c.seasonEnd,
			sourceUrl: c.sourceUrl,
			verifiedAt: c.verifiedAt
		}));
		if (classRows.length) await tx.insert(classBlocks).values(classRows);
	});

	console.log(
		`seeded from ${dir}: ${courts.locations.length} locations, ${areas.communityAreas.length} community areas, ` +
			`${areas.zips.length} ZIPs, ${overrides.overrides.length} hour overrides, ${classes.classes.length} classes`
	);
} finally {
	await client.end();
}
