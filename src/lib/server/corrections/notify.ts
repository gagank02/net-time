// Pings the owner (only) on Discord when a report arrives: at most hourly (db/corrections.ts),
// with the count, the court's name and the chosen topics. Both come from fixed lists; nothing a
// visitor typed, and nothing about them, is ever sent (Discord keeps messages past our retention).
import { env } from 'cloudflare:workers';
import { log } from '#lib/server/log.js';

/** Only Discord webhook URLs, so a mistyped secret can't make the Worker call anywhere else. */
const webhook = /^https:\/\/(discord\.com|discordapp\.com)\/api\/webhooks\/\d+\/[\w-]+$/;

/** The court's name from our data and topic codes from the form's fixed list. */
export type ReportSummary = { court: string; topics: readonly string[] };

export function notifyMessage(pending: number, report: ReportSummary): string {
	const topics = report.topics.map((t) => t.replace('_', ' ')).join(', ');
	return `New court correction on net-time: ${report.court} (${topics}). ${pending} waiting for review: run \`npm run corrections:review\`.`;
}

/** Never throws: a failed ping must not fail the visitor's report, which is already saved. */
export async function notifyOwner(
	pending: number,
	report: ReportSummary,
	requestId?: string
): Promise<void> {
	const url = env.DISCORD_WEBHOOK_URL;
	if (!url) return; // not configured (local dev): nothing to do
	if (!webhook.test(url)) {
		log('error', 'notify_failed', { requestId, reason: 'bad_webhook_url' });
		return;
	}
	try {
		const res = await fetch(url, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			// allowed_mentions: none, so the message can never ping anyone.
			body: JSON.stringify({
				content: notifyMessage(pending, report),
				allowed_mentions: { parse: [] }
			}),
			signal: AbortSignal.timeout(5000)
		});
		if (!res.ok) log('warn', 'notify_failed', { requestId, status: res.status });
	} catch {
		log('warn', 'notify_failed', { requestId, reason: 'network' });
	}
}
