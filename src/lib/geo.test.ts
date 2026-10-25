import { describe, expect, it } from 'vitest';
import { byDistance, distanceMeters, formatDistance, metersPerMile } from './geo';

describe('distanceMeters', () => {
	it('one degree of latitude ≈ 111.195 km', () => {
		expect(distanceMeters({ lat: 41, lng: -87 }, { lat: 42, lng: -87 })).toBeCloseTo(111_195, -1);
	});

	it('one degree of longitude at Chicago ≈ 111.195 km × cos(41.88°)', () => {
		const expected = 111_195 * Math.cos((41.88 * Math.PI) / 180);
		const d = distanceMeters({ lat: 41.88, lng: -88 }, { lat: 41.88, lng: -87 });
		expect(Math.abs(d - expected) / expected).toBeLessThan(0.005);
	});

	it('is symmetric and zero for the same point', () => {
		const a = { lat: 41.9195, lng: -87.6455 };
		const b = { lat: 41.8826, lng: -87.6197 };
		expect(distanceMeters(a, b)).toBeCloseTo(distanceMeters(b, a), 6);
		expect(distanceMeters(a, a)).toBe(0);
	});
});

describe('formatDistance', () => {
	it.each([
		[50, '<0.1 mi'],
		[0.84 * metersPerMile, '0.8 mi'],
		[3.45 * metersPerMile, '3.5 mi'],
		[12.4 * metersPerMile, '12 mi']
	])('%d m → %s', (m, text) => {
		expect(formatDistance(m)).toBe(text);
	});
});

describe('byDistance', () => {
	it('sorts nearest first and keeps the item', () => {
		const oz = { slug: 'oz', lat: 41.9195, lng: -87.6455 };
		const maggie = { slug: 'maggie', lat: 41.8826, lng: -87.6197 };
		const origin = { lat: 41.92, lng: -87.65 }; // Lincoln Park
		expect(byDistance([maggie, oz], origin).map((r) => r.item.slug)).toEqual(['oz', 'maggie']);
	});
});
