// Pure transform: raw OSM + City of Chicago data → reviewed-seed shape + a human-readable report.
// No network here; build-courts-seed.ts fetches (politely, cached) and calls buildCourtsSeed().
import type { z } from 'zod';
import { distanceMeters, type LatLng } from '../src/lib/geo.ts';
import type { CurationSeed } from './seed-schema.ts';

export type Ring = [number, number][]; // [lng, lat] pairs, closed
export type Polygon = Ring[]; // outer ring, then holes

export type Pitch = { id: string; lat: number; lng: number; tags: Record<string, string> };
export type Park = { id: string; name: string | null; polygons: Polygon[] };
export type CpdCourt = { park: string; parkNo: number | null; lat: number; lng: number };
export type Area = { name: string; polygons: Polygon[] };
export type Zip = { zip: string; polygons: Polygon[] };

export type Input = {
	pitches: Pitch[];
	parks: Park[];
	/** Named OSM tennis areas around courts (e.g. "Waveland Park Tennis Courts"). */
	tennisAreas: Park[];
	cpdCourts: CpdCourt[]; // 2016 tennis court points
	cpdFacilities: CpdCourt[]; // every 2016 Park District facility point (fieldhouses, playgrounds, …)
	communityAreas: Area[];
	zips: Zip[];
	curation: z.infer<typeof CurationSeed>;
	generatedAt: string; // ISO datetime
	osmTimestamp: string;
};

/** A court location counts as Park District if a 2016 CPD tennis point is this close to one of its courts. */
export const cpdMatchMeters = 150;
/** Courts further apart than this inside one big park (e.g. Lincoln Park) become separate locations. */
export const clusterMeters = 250;

// ── geometry ────────────────────────────────────────────────────────────────

function inRing([x, y]: [number, number], ring: Ring): boolean {
	let inside = false;
	for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
		const [xi, yi] = ring[i];
		const [xj, yj] = ring[j];
		if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
	}
	return inside;
}

export function inPolygons(p: LatLng, polygons: Polygon[]): boolean {
	const pt: [number, number] = [p.lng, p.lat];
	return polygons.some(
		([outer, ...holes]) => inRing(pt, outer) && !holes.some((h) => inRing(pt, h))
	);
}

function ringArea(ring: Ring): number {
	let a = 0;
	for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
		a += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
	}
	return a / 2;
}

const polygonsArea = (polygons: Polygon[]) =>
	polygons.reduce((sum, [outer]) => sum + Math.abs(ringArea(outer)), 0);

/** Area-weighted centroid of the largest polygon's outer ring. */
export function centroid(polygons: Polygon[]): LatLng {
	const [outer] = polygons.reduce((a, b) =>
		Math.abs(ringArea(b[0])) > Math.abs(ringArea(a[0])) ? b : a
	);
	let cx = 0;
	let cy = 0;
	let a = 0;
	for (let i = 0, j = outer.length - 1; i < outer.length; j = i++) {
		const f = outer[j][0] * outer[i][1] - outer[i][0] * outer[j][1];
		cx += (outer[j][0] + outer[i][0]) * f;
		cy += (outer[j][1] + outer[i][1]) * f;
		a += f;
	}
	return { lng: cx / (3 * a), lat: cy / (3 * a) };
}

/** Joins open member ways of an OSM multipolygon into closed rings (unclosable leftovers dropped). */
export function assembleRings(ways: Ring[]): Ring[] {
	const pending = ways.map((w) => [...w]);
	const rings: Ring[] = [];
	const same = (a: [number, number], b: [number, number]) => a[0] === b[0] && a[1] === b[1];
	while (pending.length) {
		let ring = pending.shift()!;
		let grown = true;
		while (!same(ring[0], ring[ring.length - 1]) && grown) {
			grown = false;
			for (let i = 0; i < pending.length; i++) {
				const w = pending[i];
				const end = ring[ring.length - 1];
				if (same(end, w[0])) ring = [...ring, ...w.slice(1)];
				else if (same(end, w[w.length - 1])) ring = [...ring, ...w.slice(0, -1).reverse()];
				else continue;
				pending.splice(i, 1);
				grown = true;
				break;
			}
		}
		if (same(ring[0], ring[ring.length - 1]) && ring.length >= 4) rings.push(ring);
	}
	return rings;
}

// ── text ────────────────────────────────────────────────────────────────────

// Letters NFKD doesn't decompose (common in Chicago's Polish and other European park names).
const fold: Record<string, string> = {
	ł: 'l',
	Ł: 'l',
	ø: 'o',
	Ø: 'o',
	đ: 'd',
	Đ: 'd',
	ß: 'ss',
	æ: 'ae',
	œ: 'oe'
};

export function slugify(name: string): string {
	return name
		.replace(/[łŁøØđĐßæœ]/g, (c) => fold[c])
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/&/g, ' and ')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 80)
		.replace(/-+$/g, '');
}

/** "LINCOLN SQUARE" → "Lincoln Square"; "OZ (L. FRANK)" → "Oz (L. Frank)". */
export const titleCase = (s: string) =>
	s
		.toLowerCase()
		.replace(/(^|[\s(.'-])([a-z])/g, (_, p: string, c: string) => p + c.toUpperCase())
		.replace(/\bMc([a-z])/g, (_, c: string) => `Mc${c.toUpperCase()}`);

/** "Lincoln (Abraham) Park" → "Lincoln Park": the Park District's formal honoree style isn't what people search for. */
export const everydayName = (name: string) =>
	name.replace(/^([^()]+?) \([^)]+\) (Park|Square|Playlot Park|Beach Park|Beach)$/, '$1 $2');

const surfaces: Record<string, 'hard' | 'clay' | 'grass' | 'other'> = {
	asphalt: 'hard',
	concrete: 'hard',
	paved: 'hard',
	acrylic: 'hard',
	hard: 'hard',
	tartan: 'hard',
	clay: 'clay',
	grass: 'grass',
	artificial_turf: 'other',
	carpet: 'other'
};

// ── transform ───────────────────────────────────────────────────────────────

/** The name of the OSM tennis area holding most of a site's courts, if one holds more than half. */
export function ownName(pitches: Pitch[], areas: Park[]): string | null {
	const counts = new Map<string, number>();
	for (const p of pitches) {
		const area = areas.find((a) => inPolygons(p, a.polygons));
		if (area?.name) counts.set(area.name, (counts.get(area.name) ?? 0) + 1);
	}
	const [best] = [...counts].sort((a, b) => b[1] - a[1]);
	return best && best[1] * 2 > pitches.length ? best[0] : null;
}

type Cluster = { parkId: string | null; parkName: string | null; pitches: Pitch[] };

function clusterByDistance(pitches: Pitch[]): Pitch[][] {
	const groups: Pitch[][] = [];
	for (const p of pitches) {
		const near = groups.filter((g) => g.some((q) => distanceMeters(p, q) <= clusterMeters));
		const merged = near.flat().concat(p);
		for (const g of near) groups.splice(groups.indexOf(g), 1);
		groups.push(merged);
	}
	return groups;
}

const mean = (pts: LatLng[]): LatLng => ({
	lat: pts.reduce((s, p) => s + p.lat, 0) / pts.length,
	lng: pts.reduce((s, p) => s + p.lng, 0) / pts.length
});

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

export function buildCourtsSeed(input: Input) {
	// The date of the OSM data read, not of this run: a rebuild from cached downloads re-verifies nothing.
	const verifiedAt = input.osmTimestamp.slice(0, 10);
	const publicPitches = input.pitches.filter((p) => !['private', 'no'].includes(p.tags.access));
	const privateCount = input.pitches.length - publicPitches.length;

	// 1. Each court → the largest park polygon containing it (else orphan). Largest, because OSM
	//    often maps named sub-areas inside big parks (e.g. "Peanut Park" inside Maggie Daley Park).
	const byPark = new Map<string, Pitch[]>();
	const orphans: Pitch[] = [];
	const parkAreas = new Map(input.parks.map((p) => [p.id, polygonsArea(p.polygons)]));
	for (const pitch of publicPitches) {
		const containing = input.parks
			.filter((park) => inPolygons(pitch, park.polygons))
			.sort((a, b) => parkAreas.get(b.id)! - parkAreas.get(a.id)!);
		if (containing.length)
			byPark.set(containing[0].id, [...(byPark.get(containing[0].id) ?? []), pitch]);
		else orphans.push(pitch);
	}

	// 2. Split big parks into separate court sites; orphans cluster on their own.
	const parkById = new Map(input.parks.map((p) => [p.id, p]));
	const clusters: Cluster[] = [];
	for (const [parkId, pitches] of byPark) {
		for (const group of clusterByDistance(pitches)) {
			clusters.push({ parkId, parkName: parkById.get(parkId)!.name, pitches: group });
		}
	}
	for (const group of clusterByDistance(orphans))
		clusters.push({ parkId: null, parkName: null, pitches: group });

	// 3. Keep clusters with a CPD tennis point nearby; derive fields.
	const areaOf = (p: LatLng) =>
		input.communityAreas.find((a) => inPolygons(p, a.polygons))?.name ?? null;
	const nearestCpd = (pitches: Pitch[]) => {
		let best: { court: CpdCourt; d: number } | null = null;
		for (const court of input.cpdCourts) {
			for (const p of pitches) {
				const d = distanceMeters(p, court);
				if (!best || d < best.d) best = { court, d };
			}
		}
		return best;
	};

	// A park polygon holding any Park District facility point is a Park District park, even if its
	// tennis courts are newer than the 2016 list.
	const cpdFacilityIn = (parkId: string | null) =>
		parkId
			? (input.cpdFacilities.find((f) => inPolygons(f, parkById.get(parkId)!.polygons)) ?? null)
			: null;

	const kept: (Cluster & { center: LatLng; area: string; cpd: CpdCourt; name: string })[] = [];
	const excluded: string[] = [];
	const outsideCity: string[] = [];
	const byParkOnly: string[] = [];
	for (const c of clusters) {
		const center = mean(c.pitches);
		const label = `${c.parkName ?? '(no park)'} · ${c.pitches.length} court(s) @ ${round6(center.lat)},${round6(center.lng)}`;
		const tennis = nearestCpd(c.pitches);
		const tennisMatch = tennis && tennis.d <= cpdMatchMeters ? tennis.court : null;
		const cpd = tennisMatch ?? cpdFacilityIn(c.parkId);
		if (!cpd) {
			excluded.push(label);
			continue;
		}
		const area = areaOf(center);
		if (!area) {
			outsideCity.push(label);
			continue;
		}
		if (!tennisMatch) byParkOnly.push(label);
		const name =
			ownName(c.pitches, input.tennisAreas) ??
			everydayName(c.parkName ?? `${titleCase(cpd.park)} Park`);
		kept.push({ ...c, center, area: titleCase(area), cpd, name });
	}

	// 4. Disambiguate parks with several court sites: by community area, then north→south position.
	const perName = new Map<string, number>();
	for (const k of kept) perName.set(k.name, (perName.get(k.name) ?? 0) + 1);
	// Names read "Lincoln Park (Lake View, north)": no dashes, per the app copy style.
	const labelOf = new Map<(typeof kept)[number], string>();
	const byLabel = new Map<string, typeof kept>();
	const sharedArea = (k: (typeof kept)[number]) =>
		perName.get(k.name)! > 1 && k.area !== k.name ? k.area : null;
	for (const k of kept) {
		const key = `${k.name}|${sharedArea(k) ?? ''}`;
		byLabel.set(key, [...(byLabel.get(key) ?? []), k]);
	}
	for (const group of byLabel.values()) {
		const sorted = [...group].sort((a, b) => b.center.lat - a.center.lat);
		const positions =
			sorted.length === 2
				? ['north', 'south']
				: sorted.length === 3
					? ['north', 'central', 'south']
					: [];
		sorted.forEach((k, i) => {
			const parts = [sharedArea(k), sorted.length > 1 ? (positions[i] ?? String(i + 1)) : null];
			const extra = parts.filter(Boolean).join(', ');
			labelOf.set(k, extra ? `${k.name} (${extra})` : k.name);
		});
	}
	const usedSlugs = new Map<string, number>();
	const collisions: string[] = [];

	const locations = kept.map((k) => {
		const displayName = labelOf.get(k)!;
		let slug = slugify(displayName);
		const n = (usedSlugs.get(slug) ?? 0) + 1;
		usedSlugs.set(slug, n);
		if (n > 1) {
			collisions.push(`${slug} → ${slug}-${n}`);
			slug = `${slug}-${n}`;
		}
		const lit = k.pitches.map((p) => p.tags.lit);
		const surfaceVotes = k.pitches.map((p) => surfaces[p.tags.surface]).filter(Boolean);
		const surface = surfaceVotes.length
			? [...new Set(surfaceVotes)].sort(
					(a, b) =>
						surfaceVotes.filter((s) => s === b).length - surfaceVotes.filter((s) => s === a).length
				)[0]
			: null;
		return {
			slug,
			name: displayName,
			address: null,
			lat: round6(k.center.lat),
			lng: round6(k.center.lng),
			courtCount: Math.min(k.pitches.length, 40),
			lights: lit.includes('yes')
				? true
				: lit.length && lit.every((v) => v === 'no')
					? false
					: null,
			surface,
			indoor: k.pitches.every((p) => p.tags.indoor === 'yes' || p.tags.building === 'yes'),
			access: 'free' as 'free' | 'reservation',
			bookingUrl: null as string | null,
			communityArea: k.area,
			cpdParkNo: k.cpd.parkNo,
			osmIds: k.pitches.map((p) => p.id).sort(),
			verifiedAt
		};
	});

	// 4b. Human curation: courts missing from OSM, and parks confirmed to have no courts.
	// CPD parks are keyed by park number: the City data spells some names two ways
	// (e.g. "MARQUETTE (JACQUES)" and "MARQUETTE (jACQUES)").
	const parkKey = (c: CpdCourt) => (c.parkNo !== null ? `#${c.parkNo}` : c.park.toUpperCase());
	const tennisParks = new Map<string, string>();
	for (const c of input.cpdCourts)
		if (!tennisParks.has(parkKey(c))) tennisParks.set(parkKey(c), c.park);
	const matched = new Set(kept.map((k) => parkKey(k.cpd)).filter((key) => tennisParks.has(key)));

	const added: string[] = [];
	const curationWarnings: string[] = [];
	for (const a of input.curation.additions) {
		// An addition with its own coordinates is a separate site (e.g. an indoor center next to
		// outdoor courts OSM already has); otherwise it fills in courts missing from OSM.
		const separateSite = a.lat !== undefined && a.lng !== undefined;
		if (!separateSite && matched.has(`#${a.cpdParkNo}`)) {
			curationWarnings.push(
				`addition ${a.slug}: OSM now has courts for park #${a.cpdParkNo}; remove the addition`
			);
			continue;
		}
		const points = separateSite
			? [{ lat: a.lat!, lng: a.lng! }]
			: input.cpdCourts.filter((c) => c.parkNo === a.cpdParkNo);
		if (!points.length)
			throw new Error(`curation addition ${a.slug}: no CPD tennis points for park #${a.cpdParkNo}`);
		if (locations.some((l) => l.slug === a.slug))
			throw new Error(`curation addition ${a.slug}: slug already used`);
		const at = mean(points);
		const area = areaOf(at);
		if (!area) throw new Error(`curation addition ${a.slug}: outside community areas`);
		locations.push({
			slug: a.slug,
			name: a.name,
			address: null,
			lat: round6(at.lat),
			lng: round6(at.lng),
			courtCount: a.courtCount,
			lights: a.lights,
			surface: a.surface,
			indoor: a.indoor,
			access: a.access,
			bookingUrl: a.bookingUrl,
			communityArea: titleCase(area),
			cpdParkNo: a.cpdParkNo,
			osmIds: [],
			verifiedAt: a.verifiedAt
		});
		matched.add(`#${a.cpdParkNo}`);
		added.push(
			`- ${a.name} (${a.courtCount} court(s)): ${a.note} Verified ${a.verifiedAt} by ${a.verifiedBy}.`
		);
	}

	// Owner verification overrides OSM: drop sites OSM still maps for parks confirmed to have no courts.
	const removed = new Set<string>();
	const removedLines: string[] = [];
	for (const r of input.curation.removed) {
		const key = `#${r.cpdParkNo}`;
		removed.add(key);
		removedLines.push(`- ${r.park}: ${r.note} Verified ${r.verifiedAt} by ${r.verifiedBy}.`);
		for (let i = locations.length - 1; i >= 0; i--) {
			const l = locations[i];
			if (l.cpdParkNo !== r.cpdParkNo) continue;
			locations.splice(i, 1);
			removedLines.push(
				`  - dropped OSM site ${l.name} (${l.courtCount} court(s), ${l.osmIds.join(' ')}): consider updating OSM`
			);
		}
		matched.delete(key);
	}
	// Field corrections from verified sources (e.g. the park's own page says the courts are lit).
	const correctedLines: string[] = [];
	for (const c of input.curation.corrections) {
		const l = locations.find((x) => x.slug === c.slug);
		if (!l) {
			curationWarnings.push(`correction ${c.slug}: no such location`);
			continue;
		}
		const changes: string[] = [];
		if (c.name !== undefined) {
			changes.push(`name ${l.name} → ${c.name}`);
			l.name = c.name;
			l.slug = slugify(c.name);
			if (locations.some((x) => x !== l && x.slug === l.slug))
				curationWarnings.push(`correction ${c.slug}: renamed slug ${l.slug} is taken`);
		}
		for (const key of ['lights', 'surface', 'courtCount', 'indoor'] as const) {
			if (c[key] === undefined) continue;
			changes.push(`${key} ${String(l[key])} → ${String(c[key])}`);
			Object.assign(l, { [key]: c[key] });
		}
		l.verifiedAt = c.verifiedAt;
		correctedLines.push(
			`- ${l.name}: ${changes.join(', ')}. ${c.note} Source: ${c.sourceUrl}. Verified ${c.verifiedAt} by ${c.verifiedBy}.`
		);
	}

	const missingCpd = [...tennisParks]
		.filter(([key]) => !matched.has(key) && !removed.has(key))
		.map(([, name]) => titleCase(name))
		.sort();
	locations.sort((a, b) => a.slug.localeCompare(b.slug));

	// 5. Community area and ZIP centroids for on-device "near me" without location permission.
	const areas = {
		communityAreas: input.communityAreas
			.map((a) => ({
				slug: slugify(a.name),
				name: titleCase(a.name),
				...roundPt(centroid(a.polygons))
			}))
			.sort((a, b) => a.name.localeCompare(b.name)),
		zips: mergeZips(input.zips)
	};

	const splitParks = [...perName]
		.filter(([, n]) => n > 1)
		.map(([name, n]) => `- ${name}: ${n} sites`);
	const pct = (n: number) => `${Math.round((100 * n) / Math.max(locations.length, 1))}%`;

	const report = [
		`# Courts seed report`,
		``,
		`Generated ${input.generatedAt} from OpenStreetMap (data as of ${input.osmTimestamp}) and City of Chicago datasets eix4-gf83, igwz-8jzy, unjd-c2ca.`,
		``,
		`## Totals`,
		``,
		`- OSM tennis courts in Chicago: ${input.pitches.length} (${privateCount} private/no access, skipped)`,
		`- Court sites (clusters): ${clusters.length}`,
		`- **Park District locations kept: ${locations.length}** (${locations.reduce((s, l) => s + l.courtCount, 0)} courts)`,
		`- Kept because inside a Park District park, though not on the 2016 tennis list: ${byParkOnly.length}`,
		`- Excluded, not a Park District site (no 2016 CPD tennis point within ${cpdMatchMeters} m, not inside a CPD park): ${excluded.length}`,
		`- Excluded, outside community areas: ${outsideCity.length}`,
		`- CPD parks with tennis (2016, by park number): ${tennisParks.size}; matched: ${matched.size - added.length}; added by hand: ${added.length}; confirmed removed: ${removed.size}; **still unexplained: ${missingCpd.length}**`,
		`- Field coverage: lights known ${pct(locations.filter((l) => l.lights !== null).length)}, surface known ${pct(locations.filter((l) => l.surface).length)}`,
		``,
		...(curationWarnings.length
			? ['## ⚠ Curation warnings', '', ...curationWarnings.map((w) => `- ${w}`), '']
			: []),
		`## CPD parks with tennis in 2016, no OSM courts, not yet curated (check: removed, or missing from OSM?)`,
		``,
		...(missingCpd.length ? missingCpd.map((p) => `- ${p}`) : ['- none']),
		``,
		`## Added by hand (data/courts.curation.json)`,
		``,
		...(added.length ? added : ['- none']),
		``,
		`## Corrected from verified sources (data/courts.curation.json)`,
		``,
		...(correctedLines.length ? correctedLines : ['- none']),
		``,
		`## Confirmed removed (data/courts.curation.json)`,
		``,
		...(removedLines.length ? removedLines : ['- none']),
		``,
		`## Kept: inside a Park District park but not on the 2016 tennis list (newer courts? please spot-check)`,
		``,
		...(byParkOnly.length ? byParkOnly.sort().map((e) => `- ${e}`) : ['- none']),
		``,
		`## OSM court sites excluded (not a Park District site: schools, universities, clubs, private?)`,
		``,
		...(excluded.length ? excluded.sort().map((e) => `- ${e}`) : ['- none']),
		``,
		`## Parks split into several locations`,
		``,
		...(splitParks.length ? splitParks : ['- none']),
		``,
		`## Slug collisions resolved`,
		``,
		...(collisions.length ? collisions.map((c) => `- ${c}`) : ['- none']),
		``
	].join('\n');

	return {
		courts: { generatedAt: input.generatedAt, locations },
		areas,
		report
	};
}

const roundPt = (p: LatLng) => ({ lat: round6(p.lat), lng: round6(p.lng) });

function mergeZips(zips: Zip[]) {
	const byZip = new Map<string, Polygon[]>();
	for (const z of zips) byZip.set(z.zip, [...(byZip.get(z.zip) ?? []), ...z.polygons]);
	return [...byZip]
		.map(([zip, polygons]) => ({ zip, ...roundPt(centroid(polygons)) }))
		.sort((a, b) => a.zip.localeCompare(b.zip));
}
