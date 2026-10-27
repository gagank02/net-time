export type LatLng = { lat: number; lng: number };

const earthRadiusM = 6_371_008.8;
const rad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in metres (haversine). Accurate to ~0.5% for city distances. */
export function distanceMeters(a: LatLng, b: LatLng): number {
	const dLat = rad(b.lat - a.lat);
	const dLng = rad(b.lng - a.lng);
	const h =
		Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
	return 2 * earthRadiusM * Math.asin(Math.sqrt(h));
}

export const metersPerMile = 1609.344;

/** "<0.1 mi", "0.8 mi", "3.4 mi", "12 mi": rounded so it never implies false precision. */
export function formatDistance(meters: number): string {
	const miles = meters / metersPerMile;
	if (miles < 0.1) return '<0.1 mi';
	if (miles < 10) return `${miles.toFixed(1)} mi`;
	return `${Math.round(miles)} mi`;
}

/** Items sorted nearest-first from origin, each with its distance. Runs on the device only. */
export function byDistance<T extends LatLng>(items: T[], origin: LatLng) {
	return items
		.map((item) => ({ item, meters: distanceMeters(origin, item) }))
		.sort((a, b) => a.meters - b.meters);
}
