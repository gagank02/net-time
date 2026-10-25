// Builds data/courts.seed.json, data/areas.seed.json and data/courts.report.md.
// Usage: npm run courts:build-seed            (uses cached downloads in .cache/ when present)
//        npm run courts:build-seed -- --refresh          (re-download everything; run rarely)
//        npm run courts:build-seed -- --refresh=cpd      (re-download one source)
//
// Third-party terms (see data/README.md):
// - Overpass API (overpass-api.de) fair use: one simple query, no per-element loops, identifying
//   User-Agent, one request at a time, 30 s pause after 429/406/5xx, max 3 attempts, results cached.
//   The app never calls Overpass at runtime. Commercial use → self-hosted/paid Overpass or an extract.
// - City of Chicago Data Portal: Data Terms of Use (verbatim disclaimer shown at /data).
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';
import { z } from 'zod';
import {
	assembleRings,
	buildCourtsSeed,
	type CpdCourt,
	type Park,
	type Pitch,
	type Polygon,
	type Ring
} from './courts-transform.ts';
import { AreasSeed, CourtsSeed } from './seed-schema.ts';

const userAgent = 'net-time-seed/0.1 (+https://github.com/gagank02/net-time)';
const refreshArg = process.argv.find((a) => a.startsWith('--refresh'));
const shouldRefresh = (name: string) =>
	refreshArg === '--refresh' || refreshArg?.split('=')[1]?.split(',').includes(name);

const overpassQuery = `[out:json][timeout:60][maxsize:67108864];
area["name"="Chicago"]["boundary"="administrative"]["admin_level"="8"]->.c;
nwr["leisure"="pitch"]["sport"~"tennis"](area.c);
out tags center;
(way["leisure"="park"](area.c);relation["leisure"="park"](area.c););
out tags geom;`;

const sources = {
	overpass: {
		url: 'https://overpass-api.de/api/interpreter',
		init: { method: 'POST', body: new URLSearchParams({ data: overpassQuery }) }
	},
	// All Park District facilities (not just tennis): a park containing any of them is a Park District park.
	cpd: { url: 'https://data.cityofchicago.org/resource/eix4-gf83.json?$limit=10000' },
	areas: { url: 'https://data.cityofchicago.org/resource/igwz-8jzy.geojson?$limit=1000' },
	zips: { url: 'https://data.cityofchicago.org/resource/unjd-c2ca.geojson?$limit=1000' }
} as const;

/** Cached, sequential, polite fetch. */
async function fetchCached(name: keyof typeof sources): Promise<unknown> {
	const path = `.cache/${name}.json`;
	if (!shouldRefresh(name)) {
		try {
			return JSON.parse(await readFile(path, 'utf8'));
		} catch {
			// not cached yet
		}
	}
	const { url, init } = { init: undefined, ...sources[name] } as {
		url: string;
		init?: RequestInit;
	};
	for (let attempt = 1; attempt <= 3; attempt++) {
		console.log(`fetching ${name} (attempt ${attempt})…`);
		const res = await fetch(url, {
			...init,
			headers: { 'user-agent': userAgent, accept: 'application/json' },
			signal: AbortSignal.timeout(120_000)
		});
		const text = await res.text();
		if (res.ok && /^\s*[[{]/.test(text)) {
			const json = JSON.parse(text);
			if (json.remark) throw new Error(`${name}: server remark: ${json.remark}`);
			await mkdir('.cache', { recursive: true });
			await writeFile(path, text);
			return json;
		}
		if (![406, 429, 502, 503, 504].includes(res.status) || attempt === 3) {
			throw new Error(`${name}: HTTP ${res.status}: ${text.slice(0, 200)}`);
		}
		const wait = 30_000 * attempt;
		console.log(`${name}: HTTP ${res.status}, waiting ${wait / 1000}s (fair-use backoff)`);
		await sleep(wait);
	}
	throw new Error('unreachable');
}

// ── parse third-party payloads (untrusted: validate shape) ─────────────────

const LatLon = z.object({ lat: z.number(), lon: z.number() });
const OsmElement = z.object({
	type: z.enum(['node', 'way', 'relation']),
	id: z.number(),
	lat: z.number().optional(),
	lon: z.number().optional(),
	center: LatLon.optional(),
	tags: z.record(z.string(), z.string()).default({}),
	geometry: z.array(LatLon.nullable()).optional(),
	members: z
		.array(
			z.object({
				type: z.string(),
				role: z.string(),
				geometry: z.array(LatLon.nullable()).optional()
			})
		)
		.optional()
});
const Overpass = z.object({
	osm3s: z.object({ timestamp_osm_base: z.string() }),
	elements: z.array(OsmElement)
});

const toRing = (g: (z.infer<typeof LatLon> | null)[]): Ring =>
	g.filter((p): p is z.infer<typeof LatLon> => p !== null).map((p) => [p.lon, p.lat]);

function parseOverpass(raw: unknown) {
	const data = Overpass.parse(raw);
	const pitches: Pitch[] = [];
	const parks: Park[] = [];
	for (const el of data.elements) {
		const id = `${el.type}/${el.id}`;
		if (el.tags.leisure === 'pitch') {
			const at = el.center ?? (el.lat !== undefined ? { lat: el.lat, lon: el.lon! } : null);
			if (at) pitches.push({ id, lat: at.lat, lng: at.lon, tags: el.tags });
		} else if (el.tags.leisure === 'park') {
			let polygons: Polygon[] = [];
			if (el.type === 'way' && el.geometry) polygons = [[toRing(el.geometry)]];
			if (el.type === 'relation' && el.members) {
				const ways = (role: string) =>
					el.members!.filter((m) => m.role === role && m.geometry).map((m) => toRing(m.geometry!));
				const holes = assembleRings(ways('inner'));
				polygons = assembleRings(ways('outer')).map((outer) => [outer, ...holes]);
			}
			if (polygons.length) parks.push({ id, name: el.tags.name ?? null, polygons });
		}
	}
	return { pitches, parks, osmTimestamp: data.osm3s.timestamp_osm_base };
}

const Cpd = z.array(
	z.object({
		park: z.string(),
		park_no: z.string().optional(),
		facility_n: z.string().optional(),
		the_geom: z.object({ coordinates: z.tuple([z.number(), z.number()]) })
	})
);

const Feature = z.object({
	properties: z.record(z.string(), z.unknown()),
	geometry: z.object({
		type: z.enum(['Polygon', 'MultiPolygon']),
		coordinates: z.array(z.unknown())
	})
});
const Features = z.object({ features: z.array(Feature) });

const polygonsOf = (g: z.infer<typeof Feature>['geometry']): Polygon[] =>
	(g.type === 'Polygon' ? [g.coordinates] : g.coordinates) as Polygon[];

// ── main ───────────────────────────────────────────────────────────────────

const osm = parseOverpass(await fetchCached('overpass'));
const cpdRows = Cpd.parse(await fetchCached('cpd'));
const toCpd = (r: (typeof cpdRows)[number]): CpdCourt => ({
	park: r.park,
	parkNo: r.park_no ? Math.trunc(Number(r.park_no)) || null : null,
	lng: r.the_geom.coordinates[0],
	lat: r.the_geom.coordinates[1]
});
const cpdCourts = cpdRows.filter((r) => r.facility_n === 'TENNIS COURT').map(toCpd);
const cpdFacilities = cpdRows.map(toCpd);
const communityAreas = Features.parse(await fetchCached('areas')).features.map((f) => ({
	name: String(f.properties.community),
	polygons: polygonsOf(f.geometry)
}));
const zips = Features.parse(await fetchCached('zips')).features.map((f) => ({
	zip: String(f.properties.zip),
	polygons: polygonsOf(f.geometry)
}));

const { courts, areas, report } = buildCourtsSeed({
	...osm,
	cpdCourts,
	cpdFacilities,
	communityAreas,
	zips,
	generatedAt: new Date().toISOString().replace(/\.\d+Z$/, 'Z')
});

// Validate before writing: the output must load with db-seed.
CourtsSeed.parse(courts);
AreasSeed.parse(areas);

await writeFile('data/courts.seed.json', JSON.stringify(courts, null, '\t') + '\n');
await writeFile('data/areas.seed.json', JSON.stringify(areas, null, '\t') + '\n');
await writeFile('data/courts.report.md', report);
console.log(report.split('## CPD')[0]);
