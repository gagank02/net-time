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
