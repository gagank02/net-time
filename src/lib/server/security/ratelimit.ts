export type Bucket = 'global' | 'write' | 'auth';

const bindings = { global: 'RL_GLOBAL', write: 'RL_WRITE', auth: 'RL_AUTH' } as const;

/**
 * Returns true if the request is allowed. Fails closed: a missing or erroring
 * binding denies, so a misconfiguration can't silently disable rate limiting.
 */
export async function limit(
	platform: App.Platform | undefined,
	bucket: Bucket,
	key: string
): Promise<boolean> {
	const binding = platform?.env?.[bindings[bucket]];
	if (!binding) return false;
	try {
		const { success } = await binding.limit({ key });
		return success;
	} catch {
		return false;
	}
}
