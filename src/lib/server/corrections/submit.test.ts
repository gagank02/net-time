import { env } from 'cloudflare:workers';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { storeCorrection } from '#lib/server/db/corrections.js';
import { verifyTurnstile } from '#lib/server/security/turnstile.js';
import { notifyOwner } from './notify';
import { hmac, maxBodyBytes, readCapped, submitCorrection } from './submit';

vi.mock('#lib/server/db/corrections.js', () => ({ storeCorrection: vi.fn() }));
vi.mock('#lib/server/security/turnstile.js', () => ({ verifyTurnstile: vi.fn() }));
vi.mock('./notify', () => ({ notifyOwner: vi.fn().mockResolvedValue(undefined) }));

const vars = env as unknown as Record<string, unknown>;
const origin = 'https://net-time.example';
const ip = '203.0.113.5';
const courts = new Set(['waveland-park']);
// 2026-10-28 03:00 UTC is still Oct 27 in Chicago.
const now = new Date('2026-10-28T03:00:00Z');
const fields = {
	topics: 'hours',
	details: 'Courts close at 9 PM now.',
	'cf-turnstile-response': 'tok'
};

function post(
	body: Record<string, string> | string = fields,
	headers: Record<string, string> = {}
): Request {
	return new Request(`${origin}/courts/waveland-park/suggest`, {
		method: 'POST',
		headers: {
			'content-type': 'application/x-www-form-urlencoded',
			origin,
			...headers
		},
		body: typeof body === 'string' ? body : new URLSearchParams(body)
	});
}

const submit = (req: Request, court = 'waveland-park') =>
	submitCorrection(req, { court, ip, courts, now });
const logs = () =>
	[...vi.mocked(console.log).mock.calls, ...vi.mocked(console.warn).mock.calls].map((c) =>
		JSON.parse(String(c[0]))
	);

beforeEach(() => {
	vars.CORRECTIONS_HMAC_KEY = 'test-key';
	vi.mocked(verifyTurnstile).mockResolvedValue(true);
	vi.mocked(storeCorrection).mockResolvedValue({ result: 'stored', pending: 1, notify: false });
	vi.spyOn(console, 'log').mockImplementation(() => {});
	vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
	vi.clearAllMocks();
	vi.restoreAllMocks();
	delete vars.CORRECTIONS_HMAC_KEY;
});

describe('submitCorrection', () => {
	it('stores a valid report with the Chicago date and hashed keys only', async () => {
		expect(await submit(post())).toEqual({ outcome: 'ok' });
		expect(verifyTurnstile).toHaveBeenCalledWith('tok', 'correction', 'net-time.example');
		const [report, rateKey, day] = vi.mocked(storeCorrection).mock.calls[0];
		expect(day).toBe('2026-10-27');
		expect(report).toMatchObject({
			courtSlug: 'waveland-park',
			topics: ['hours'],
			details: 'Courts close at 9 PM now.'
		});
		expect(rateKey).toMatch(/^[0-9a-f]{64}$/);
		expect(JSON.stringify([report, rateKey])).not.toContain(ip);
	});

	it('takes the court from the page address, not the form body', async () => {
		expect(await submit(post({ ...fields, court: 'somewhere-else' }))).toEqual({ outcome: 'ok' });
		expect(vi.mocked(storeCorrection).mock.calls[0][0].courtSlug).toBe('waveland-park');
		expect(await submit(post(), 'no-such-court')).toMatchObject({ outcome: 'invalid' });
	});

	it.each([
		['wrong origin', post(fields, { origin: 'https://evil.example' })],
		['no origin', post(fields, { origin: '' })],
		['multipart body', post(fields, { 'content-type': 'multipart/form-data; boundary=x' })],
		['JSON body', post(JSON.stringify(fields), { 'content-type': 'application/json' })],
		['oversized body', post({ ...fields, details: 'a'.repeat(maxBodyBytes) })]
	])('refuses a malformed request: %s', async (_, req) => {
		expect(await submit(req)).toEqual({ outcome: 'bad_request' });
		expect(verifyTurnstile).not.toHaveBeenCalled();
		expect(storeCorrection).not.toHaveBeenCalled();
	});

	it('pretends to accept a filled honeypot but stores nothing', async () => {
		expect(await submit(post({ ...fields, company_fax: '555' }))).toEqual({ outcome: 'ok' });
		expect(storeCorrection).not.toHaveBeenCalled();
		expect(logs()).toEqual([expect.objectContaining({ event: 'correction', reason: 'honeypot' })]);
	});

	it('returns field errors before spending the Turnstile token', async () => {
		const result = await submit(post({ ...fields, details: 'see spam.com' }));
		expect(result).toMatchObject({
			outcome: 'invalid',
			errors: { details: expect.any(String) },
			values: { topics: ['hours'], details: 'see spam.com' }
		});
		expect(verifyTurnstile).not.toHaveBeenCalled();
	});

	it('refuses when Turnstile fails', async () => {
		vi.mocked(verifyTurnstile).mockResolvedValue(false);
		expect(await submit(post())).toEqual({ outcome: 'turnstile_failed' });
		expect(storeCorrection).not.toHaveBeenCalled();
	});

	it.each(['rate_limited', 'queue_full'] as const)('passes on %s from the store', async (r) => {
		vi.mocked(storeCorrection).mockResolvedValue({ result: r });
		expect(await submit(post())).toEqual({ outcome: r });
	});

	it('treats a same-day duplicate as success', async () => {
		vi.mocked(storeCorrection).mockResolvedValue({ result: 'duplicate' });
		expect(await submit(post())).toEqual({ outcome: 'ok' });
		expect(notifyOwner).not.toHaveBeenCalled();
	});

	it('pings the owner only when the store says the hourly slot is free', async () => {
		await submit(post());
		expect(notifyOwner).not.toHaveBeenCalled();
		vi.mocked(storeCorrection).mockResolvedValue({ result: 'stored', pending: 3, notify: true });
		await submit(post());
		expect(notifyOwner).toHaveBeenCalledWith(3, undefined);
	});

	it('hands the ping to waitUntil so the visitor doesn’t wait for Discord', async () => {
		vi.mocked(storeCorrection).mockResolvedValue({ result: 'stored', pending: 1, notify: true });
		const waitUntil = vi.fn();
		await submitCorrection(post(), { court: 'waveland-park', ip, courts, now, waitUntil });
		expect(waitUntil).toHaveBeenCalledWith(expect.any(Promise));
	});

	it('fails closed without the HMAC key or when the database errors', async () => {
		delete vars.CORRECTIONS_HMAC_KEY;
		expect(await submit(post())).toEqual({ outcome: 'unavailable' });
		vars.CORRECTIONS_HMAC_KEY = 'test-key';
		vi.mocked(storeCorrection).mockRejectedValue(new Error('Failed query ... params: secret text'));
		expect(await submit(post())).toEqual({ outcome: 'unavailable' });
	});

	it('logs outcome codes only: never the report, IP or error text', async () => {
		vi.mocked(storeCorrection).mockRejectedValueOnce(new Error('params: Courts close at 9 PM'));
		await submit(post());
		await submit(post({ ...fields, details: 'shit' }));
		expect(
			logs()
				.map((l) => l.reason)
				.sort()
		).toEqual(['invalid', 'unavailable']);
		const text = JSON.stringify(logs());
		for (const leak of [ip, 'Courts close', 'shit', 'waveland-park', 'tok']) {
			expect(text).not.toContain(leak);
		}
	});
});

describe('error messages', () => {
	// Visitors see these. Library defaults ("Invalid input: expected array, received undefined")
	// must never get through.
	const jargon =
		/invalid input|expected|received|unrecognized|undefined|array|string|zod|nan|https?:|punycode|regex/i;
	const cases: [string, string][] = [
		['nothing ticked', 'details=Courts+close+at+9'],
		['empty form', ''],
		['bad topic', 'topics=prices&details=x'],
		['details missing', 'topics=hours'],
		['details sent twice', 'topics=hours&details=a&details=b'],
		['date sent twice', 'topics=hours&details=a&seen_on=2026-10-01&seen_on=2026-10-02'],
		['bad date', 'topics=hours&details=a&seen_on=soon'],
		['link in details', 'topics=hours&details=see+a.com'],
		['a source link sent anyway', 'topics=hours&details=a&source_url=https://a.com'],
		['unknown field', 'topics=hours&details=a&email=a@b.co'],
		['honeypot sent twice', 'topics=hours&details=a&company_fax=&company_fax='],
		['token sent twice', 'topics=hours&details=a&cf-turnstile-response=a&cf-turnstile-response=b']
	];

	it.each(cases)('are plain words: %s', async (_, body) => {
		const result = await submit(post(body));
		expect(result.outcome).toBe('invalid');
		const messages = Object.values(result.outcome === 'invalid' ? result.errors : {});
		expect(messages.length).toBeGreaterThan(0);
		for (const m of messages) expect(m).not.toMatch(jargon);
	});

	it('names only fields the visitor can see; anything else is a form-level message', async () => {
		const result = await submit(post('topics=hours&details=a&email=a@b.co'));
		expect(result).toMatchObject({ outcome: 'invalid', errors: { _form: expect.any(String) } });
		expect(Object.keys(result.outcome === 'invalid' ? result.errors : {})).toEqual(['_form']);
	});

	it('asks for a topic in plain words when none is ticked', async () => {
		expect(await submit(post('details=Courts+close+at+9'))).toMatchObject({
			errors: { topics: 'Pick at least one thing that’s wrong.' }
		});
	});
});

describe('hmac', () => {
	it('gives different rate keys on different days and never contains the IP', async () => {
		const a = await hmac('k', `limit\n${ip}\n2026-10-27`);
		const b = await hmac('k', `limit\n${ip}\n2026-10-28`);
		expect(a).not.toBe(b);
		expect(a).not.toContain(ip);
		expect(a).toBe(await hmac('k', `limit\n${ip}\n2026-10-27`));
	});
});

describe('readCapped', () => {
	it('reads up to the cap and refuses one byte more', async () => {
		const at = new Request(origin, { method: 'POST', body: 'a'.repeat(10) });
		expect(await readCapped(at, 10)).toBe('a'.repeat(10));
		const over = new Request(origin, { method: 'POST', body: 'a'.repeat(11) });
		expect(await readCapped(over, 10)).toBeNull();
	});

	it('decodes multi-byte characters split across chunks', async () => {
		const bytes = new TextEncoder().encode('café');
		const body = new ReadableStream({
			start(c) {
				c.enqueue(bytes.slice(0, 4));
				c.enqueue(bytes.slice(4));
				c.close();
			}
		});
		const req = new Request(origin, { method: 'POST', body, duplex: 'half' } as RequestInit);
		expect(await readCapped(req, 100)).toBe('café');
	});
});
