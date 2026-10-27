import { env } from 'cloudflare:workers';
import { afterEach, describe, expect, it } from 'vitest';
import { load } from './+page.server';

const vars = env as unknown as Record<string, unknown>;
const run = () => (load as () => unknown)();

describe('/__e2e/throw gate', () => {
	afterEach(() => delete vars.E2E_ROUTES);

	it('is a 404 unless E2E_ROUTES=1', () => {
		expect(run).toThrow(expect.objectContaining({ status: 404 }));
	});

	it('throws an unknown error when enabled', () => {
		vars.E2E_ROUTES = '1';
		expect(run).toThrow('SECRET-DETAIL');
	});
});
