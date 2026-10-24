import { afterEach, describe, expect, it, vi } from 'vitest';
import { describeError, log } from './log';

afterEach(() => vi.restoreAllMocks());

describe('log', () => {
	it('writes one JSON line with level and event', () => {
		const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
		log('info', 'request', { requestId: 'r1', status: 200 });
		expect(JSON.parse(spy.mock.calls[0][0])).toEqual({
			level: 'info',
			event: 'request',
			requestId: 'r1',
			status: 200
		});
	});

	it('drops fields that are not allowlisted', () => {
		const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
		log('warn', 'x', {
			requestId: 'r1',
			cookie: 'session=abc',
			authorization: 'Bearer t0ken',
			email: 'a@b.com',
			body: '{"password":"p"}',
			lat: 41.88
		});
		const line = spy.mock.calls[0][0] as string;
		expect(JSON.parse(line)).toEqual({ level: 'warn', event: 'x', requestId: 'r1' });
		for (const secret of ['session=abc', 't0ken', 'a@b.com', 'password', '41.88']) {
			expect(line).not.toContain(secret);
		}
	});

	it('routes errors to console.error', () => {
		const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
		log('error', 'boom');
		expect(spy).toHaveBeenCalledOnce();
	});
});

describe('describeError', () => {
	it('redacts email addresses in error text', () => {
		const text = describeError(new Error('Key (email)=(jane.doe@example.com) already exists'));
		expect(text).toContain('[email]');
		expect(text).not.toContain('jane.doe@example.com');
	});

	it('handles non-Error values', () => {
		expect(describeError('plain')).toBe('plain');
	});
});
