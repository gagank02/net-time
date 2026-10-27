import { describe, expect, it, vi } from 'vitest';
import { withDb } from '#lib/server/db/client.js';
import { GET } from './+server';

vi.mock('#lib/server/db/client.js', () => ({ withDb: vi.fn() }));

const call = () => GET({} as Parameters<typeof GET>[0]);

describe('GET /healthz', () => {
	it('returns 200 ok when the DB answers', async () => {
		vi.mocked(withDb).mockResolvedValueOnce(undefined);
		const res = await call();
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ status: 'ok' });
	});

	it('returns 503 with no details when the DB fails', async () => {
		vi.mocked(withDb).mockRejectedValueOnce(
			new Error('password authentication failed for net_time_app@10.0.0.5')
		);
		const res = await call();
		expect(res.status).toBe(503);
		expect(await res.text()).toBe('{"status":"unavailable"}');
		expect(res.headers.get('cache-control')).toBe('no-store');
	});
});
