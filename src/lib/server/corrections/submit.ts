// One anonymous correction, from raw request to stored row (SPEC-submissions, "Security").
// Cheap checks first; nothing a visitor sent is logged, and the IP only ever enters an HMAC.
import { env } from 'cloudflare:workers';
import { chicagoTime } from '#lib/courts/status.js';
import { storeCorrection } from '#lib/server/db/corrections.js';
import { log } from '#lib/server/log.js';
import { verifyTurnstile } from '#lib/server/security/turnstile.js';
import { notifyOwner } from './notify';
import { honeypotField, parseCorrection, tampered, turnstileField } from './validate';

export const maxBodyBytes = 4096;
export const turnstileAction = 'correction';
const visibleFields = new Set(['topics', 'details', 'seen_on']);

export type Outcome =
	| { outcome: 'ok' }
	| { outcome: 'invalid'; errors: Record<string, string>; values: FormValues }
	| { outcome: 'bad_request' | 'turnstile_failed' | 'rate_limited' | 'queue_full' | 'unavailable' };

/** What the visitor typed, returned only to refill their own form after a field error. */
export type FormValues = Partial<Record<'details' | 'seen_on', string>> & {
	topics?: string[];
};

/** Log reason for an outcome. Honeypot and duplicates look like success to the sender. */
export type Reason = Outcome['outcome'] | 'honeypot' | 'duplicate';

/** Reads at most `max` bytes of the body, or null if it's longer. Content-Length isn't trusted. */
export async function readCapped(request: Request, max: number): Promise<string | null> {
	if (!request.body) return '';
	const reader = request.body.getReader();
	const decoder = new TextDecoder();
	let text = '';
	let size = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) return text + decoder.decode();
		size += value.byteLength;
		if (size > max) {
			await reader.cancel();
			return null;
		}
		text += decoder.decode(value, { stream: true });
	}
}

/** HMAC-SHA256 hex. With a daily date in `message`, keys can't be linked across days. */
export async function hmac(secret: string, message: string): Promise<string> {
	const key = await crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	);
	const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
	return Array.from(new Uint8Array(mac), (b) => b.toString(16).padStart(2, '0')).join('');
}

type Context = {
	/** From the page address (/courts/[slug]/suggest), never from the form body. */
	court: string;
	ip: string;
	courts: ReadonlySet<string>;
	now: Date;
	requestId?: string;
	/** Keeps the owner ping running after the response is sent (Workers' ctx.waitUntil). */
	waitUntil?: (p: Promise<unknown>) => void;
};

/** Handles one submission and logs only its outcome code: never the body, IP or error text. */
export async function submitCorrection(request: Request, ctx: Context): Promise<Outcome> {
	const { result, reason } = await check(request, ctx);
	log(result.outcome === 'ok' || reason === 'invalid' ? 'info' : 'warn', 'correction', {
		requestId: ctx.requestId,
		reason
	});
	return result;
}

async function check(request: Request, ctx: Context): Promise<{ result: Outcome; reason: Reason }> {
	const fail = (outcome: Exclude<Outcome['outcome'], 'ok' | 'invalid'>) => ({
		result: { outcome } as Outcome,
		reason: outcome
	});
	const url = new URL(request.url);

	// 1. Shape: a same-origin, plain HTML form post of bounded size.
	const type = request.headers.get('content-type') ?? '';
	if (
		request.method !== 'POST' ||
		!type.startsWith('application/x-www-form-urlencoded') ||
		request.headers.get('origin') !== url.origin
	) {
		return fail('bad_request');
	}
	const body = await readCapped(request, maxBodyBytes);
	if (body === null) return fail('bad_request');
	const form = new FormData();
	for (const [k, v] of new URLSearchParams(body)) form.append(k, v);
	form.set('court', ctx.court);

	// Bots fill every field; people never see this one. Look successful, store nothing.
	if (form.get(honeypotField)) return { result: { outcome: 'ok' }, reason: 'honeypot' };

	// 2. Fields, before Turnstile: a typo shouldn't spend the visitor's single-use token.
	const { date: today } = chicagoTime(ctx.now);
	const parsed = parseCorrection(form, ctx.courts, today);
	if (!parsed.ok) {
		const values: FormValues = {
			topics: form.getAll('topics').filter((t) => typeof t === 'string')
		};
		for (const key of ['details', 'seen_on'] as const) {
			const v = form.get(key);
			if (typeof v === 'string') values[key] = v;
		}
		// Only the visible fields get their own message; anything else means a tampered request.
		const errors: Record<string, string> = {};
		for (const [field, message] of Object.entries(parsed.errors)) {
			if (visibleFields.has(field)) errors[field] = message;
			else errors._form = tampered;
		}
		return { result: { outcome: 'invalid', errors, values }, reason: 'invalid' };
	}

	// 3. Bot check, bound to this form and this host.
	if (!(await verifyTurnstile(form.get(turnstileField), turnstileAction, url.hostname))) {
		return fail('turnstile_failed');
	}

	// 4. Limits and storage. The raw IP never leaves this function.
	const secret = env.CORRECTIONS_HMAC_KEY;
	if (!secret) return fail('unavailable');
	const { court, topics, details, seen_on } = parsed.data;
	const [rateKey, dedupeKey] = await Promise.all([
		hmac(secret, `limit\n${ctx.ip}\n${today}`),
		hmac(
			secret,
			`dedupe\n${court}\n${[...topics].sort().join(',')}\n${details.toLowerCase()}\n${today}`
		)
	]);
	let stored;
	try {
		stored = await storeCorrection(
			{ courtSlug: court, topics, details, seenOn: seen_on, dedupeKey },
			rateKey,
			today
		);
	} catch {
		// Not logged: Drizzle's error text includes the query parameters, i.e. the report itself.
		return fail('unavailable');
	}
	if (stored.result === 'rate_limited' || stored.result === 'queue_full')
		return fail(stored.result);
	if (stored.result === 'stored' && stored.notify) {
		const ping = notifyOwner(stored.pending, ctx.requestId);
		if (ctx.waitUntil) ctx.waitUntil(ping);
		else await ping;
	}
	return { result: { outcome: 'ok' }, reason: stored.result === 'duplicate' ? 'duplicate' : 'ok' };
}
