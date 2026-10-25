import { env } from 'cloudflare:workers';

/**
 * The request's "now". Test-only override via ?at=ISO, honoured only when E2E_ROUTES=1, which
 * production never sets, so status tests can pin a time.
 */
export function requestNow(url: URL): Date {
	const at = url.searchParams.get('at');
	if (at && (env as { E2E_ROUTES?: string }).E2E_ROUTES === '1') {
		const d = new Date(at);
		if (!Number.isNaN(d.getTime())) return d;
	}
	return new Date();
}
