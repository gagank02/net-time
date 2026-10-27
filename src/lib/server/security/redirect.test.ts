import { describe, expect, it } from 'vitest';
import { safeRedirectPath } from './redirect';

describe('safeRedirectPath', () => {
	it('keeps same-origin paths with query and hash', () => {
		expect(safeRedirectPath('/courts?near=me#map')).toBe('/courts?near=me#map');
		expect(safeRedirectPath('/')).toBe('/');
	});

	it.each([
		'//evil.com',
		'/\\evil.com',
		'/\t/evil.com',
		'/\n/evil.com',
		'https://evil.com',
		'javascript:alert(1)',
		'evil.com',
		'',
		undefined,
		null,
		42
	])('rejects %j', (value) => {
		expect(safeRedirectPath(value)).toBe('/');
	});
});
