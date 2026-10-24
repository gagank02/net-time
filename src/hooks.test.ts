import { env } from 'cloudflare:workers';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RequestEvent } from '@sveltejs/kit';
import { handleError, rateLimit } from './hooks.server';

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

// rateLimit is tested alone: sequence() needs SvelteKit's request store. e2e/ratelimit.e2e.ts covers
// the composed chain (429 responses carry security headers).
describe('rateLimit hook', () => {
	const bindings = env as unknown as Record<string, unknown>;

	function call(ip = '203.0.113.9') {
		const resolve = vi.fn(async () => new Response('ok'));
		const ev = {
			locals: {},
			route: { id: '/' },
			request: new Request('http://localhost/'),
			getClientAddress: () => ip
		} as unknown as RequestEvent;
		return { resolve, response: rateLimit({ event: ev, resolve }) };
	}

	afterEach(() => delete bindings.RL_GLOBAL);

	it('passes allowed requests through', async () => {
		vi.spyOn(console, 'log').mockImplementation(() => {});
		bindings.RL_GLOBAL = { limit: async () => ({ success: true }) };
		const { resolve, response } = call();
		const res = await response;
		expect(res.status).toBe(200);
		expect(resolve).toHaveBeenCalledOnce();
	});

	it('returns 429 with Retry-After when limited, without resolving', async () => {
		vi.spyOn(console, 'log').mockImplementation(() => {});
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		bindings.RL_GLOBAL = { limit: async () => ({ success: false }) };
		const { resolve, response } = call('203.0.113.9');
		const res = await response;
		expect(res.status).toBe(429);
		expect(res.headers.get('retry-after')).toBe('60');
		expect(resolve).not.toHaveBeenCalled();

		const line = warn.mock.calls[0][0] as string;
		expect(JSON.parse(line)).toMatchObject({
			event: 'rate_limited',
			reason: 'limited',
			ipPrefix: '203.0.113.0/24'
		});
		expect(line).not.toContain('203.0.113.9');
	});

	it('fails closed with 503 when the limiter is unavailable', async () => {
		vi.spyOn(console, 'log').mockImplementation(() => {});
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		const { resolve, response } = call();
		const res = await response;
		expect(res.status).toBe(503);
		expect(resolve).not.toHaveBeenCalled();
	});
});
