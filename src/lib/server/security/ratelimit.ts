import { env } from 'cloudflare:workers';

export type Bucket = 'global' | 'write' | 'auth';
export type LimitResult = 'allowed' | 'limited' | 'unavailable';

const bindings = { global: 'RL_GLOBAL', write: 'RL_WRITE', auth: 'RL_AUTH' } as const;

/** Window length for every bucket (wrangler.jsonc `period`), used for Retry-After. */
export const periodSeconds = 60;

/** 'unavailable' when the binding is missing or errors, so callers can fail closed. */
export async function checkLimit(bucket: Bucket, key: string): Promise<LimitResult> {
	const binding = env[bindings[bucket]] as RateLimit | undefined;
	if (!binding) return 'unavailable';
	try {
		const { success } = await binding.limit({ key });
		return success ? 'allowed' : 'limited';
	} catch {
		return 'unavailable';
	}
}

/** True if allowed. Fails closed: a missing or erroring binding denies. */
export async function limit(bucket: Bucket, key: string): Promise<boolean> {
	return (await checkLimit(bucket, key)) === 'allowed';
}

/** Coarse IP for logs: IPv4 /24, IPv6 /48. Enough to spot abuse patterns, not to identify a person. */
export function ipPrefix(ip: string): string {
	if (ip.includes(':')) return ip.split(':').slice(0, 3).join(':') + '::/48';
	const parts = ip.split('.');
	return parts.length === 4 ? `${parts.slice(0, 3).join('.')}.0/24` : 'unknown';
}
