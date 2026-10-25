import { env } from 'cloudflare:workers';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { listCourts } from '#lib/server/courts/queries.js';
import { load } from './+page.server';

vi.mock('#lib/server/courts/queries.js', () => ({ listCourts: vi.fn(async () => []) }));

const vars = env as unknown as Record<string, unknown>;
const run = (query: string) =>
	(load as (e: { url: URL }) => Promise<{ now: string }>)({
		url: new URL(`http://localhost/courts${query}`)
	});

describe('/courts test clock (?at=)', () => {
	afterEach(() => delete vars.E2E_ROUTES);

	it('is ignored unless E2E_ROUTES=1 (production never sets it)', async () => {
		const before = Date.now();
		const { now } = await run('?at=2020-01-01T00:00:00Z');
		expect(new Date(now).getTime()).toBeGreaterThanOrEqual(before);
	});

	it('is honoured with E2E_ROUTES=1, and drives the season date for the query', async () => {
		vars.E2E_ROUTES = '1';
		const { now } = await run('?at=2026-10-26T10:00:00-05:00');
		expect(now).toBe('2026-10-26T15:00:00.000Z');
		expect(listCourts).toHaveBeenLastCalledWith('2026-10-26');
	});

	it('falls back to the real clock for an invalid value', async () => {
		vars.E2E_ROUTES = '1';
		const before = Date.now();
		const { now } = await run('?at=not-a-date');
		expect(new Date(now).getTime()).toBeGreaterThanOrEqual(before);
	});
});
