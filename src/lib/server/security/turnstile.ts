import { env } from 'cloudflare:workers';
import { log } from '#lib/server/log.js';

const siteverify = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

/**
 * Verifies a Turnstile token server-side. Fails closed: missing token, missing secret, network
 * error, or a non-success response all return false. Tokens are single-use and expire in 5 min.
 * Pass `action` when the widget sets one, so a token from one form can't be replayed on another,
 * and `hostname` (ours) so a token solved on another site is useless here.
 * The visitor's IP is deliberately not sent (`remoteip` is optional; see /privacy).
 */
export async function verifyTurnstile(
	token: FormDataEntryValue | null | undefined,
	action?: string,
	hostname?: string
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
				idempotency_key: crypto.randomUUID()
			}),
			signal: AbortSignal.timeout(5000)
		});
		if (!res.ok) return false;
		const outcome = (await res.json()) as {
			success?: boolean;
			action?: string;
			hostname?: string;
			metadata?: { result_with_testing_key?: boolean };
		};
		if (outcome.success !== true) return false;
		// Cloudflare's published test keys (local dev, CI) answer with hostname "example.com" and no
		// action. Only a test *secret* gets this flag, and with one every token passes anyway, so the
		// live E2E checks production refuses the test token (i.e. has a real secret).
		if (outcome.metadata?.result_with_testing_key === true) return true;
		if (hostname !== undefined && outcome.hostname !== hostname) return false;
		return action === undefined || outcome.action === action;
	} catch {
		return false;
	}
}
