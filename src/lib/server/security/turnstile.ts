import { env } from 'cloudflare:workers';
import { log } from '#lib/server/log.js';

const siteverify = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/**
 * Verifies a Turnstile token server-side. Fails closed: missing token, missing secret, network
 * error, or a non-success response all return false. Tokens are single-use and expire in 5 min.
 * Pass `action` when the widget sets one, so a token from one form can't be replayed on another.
 */
export async function verifyTurnstile(
	token: FormDataEntryValue | null,
	ip: string,
	action?: string
): Promise<boolean> {
	if (typeof token !== 'string' || token.length === 0 || token.length > 2048) return false;
	const secret = env.TURNSTILE_SECRET;
	if (!secret) {
		log('error', 'turnstile_misconfigured', { reason: 'missing TURNSTILE_SECRET' });
		return false;
	}

	try {
		const res = await fetch(siteverify, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				secret,
				response: token,
				remoteip: ip,
				idempotency_key: crypto.randomUUID()
			}),
			signal: AbortSignal.timeout(5000)
		});
		if (!res.ok) return false;
		const outcome = (await res.json()) as { success?: boolean; action?: string };
		if (outcome.success !== true) return false;
		return action === undefined || outcome.action === action;
	} catch {
		return false;
	}
}
