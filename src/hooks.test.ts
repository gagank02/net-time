import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
import { handleError } from './hooks.server';

const event = {
	locals: { requestId: 'req-123' },
	route: { id: '/courts/[id]' }
} as unknown as RequestEvent;

type Input = Parameters<typeof handleError>[0];

afterEach(() => vi.restoreAllMocks());

describe('handleError', () => {
	it('returns a generic message with the request id for unknown errors', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const result = await handleError({
			kind: 'unknown',
			error: new Error('relation "users" does not exist at /srv/app/db.ts:12'),
			event
		} as Input);
		expect(result).toEqual({ message: 'Something went wrong', id: 'req-123' });
		expect(JSON.stringify(result)).not.toMatch(/relation|users|\/srv|db\.ts/);
	});

	it('logs the full error server-side with the same id', async () => {
		const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
		await handleError({ kind: 'unknown', error: new Error('boom detail'), event } as Input);
		const entry = JSON.parse(spy.mock.calls[0][0]);
		expect(entry).toMatchObject({
			level: 'error',
			event: 'unhandled_error',
			requestId: 'req-123',
			route: '/courts/[id]'
		});
		expect(entry.error).toContain('boom detail');
	});

	it('keeps safe framework messages (e.g. 404) and only adds the id', async () => {
		const spy = vi.spyOn(console, 'error');
		const result = await handleError({
			kind: 'framework',
			error: { status: 404, message: 'Not Found' },
			event
		} as Input);
		expect(result).toEqual({ id: 'req-123' });
		expect(spy).not.toHaveBeenCalled();
	});
});
