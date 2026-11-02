import { env } from 'cloudflare:workers';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { notifyMessage, notifyOwner } from './notify';

const vars = env as unknown as Record<string, unknown>;
const hook = 'https://discord.com/api/webhooks/123456/abc-DEF_789';
const report = { court: 'Waveland Park Tennis Courts', topics: ['surface', 'court_count'] };

beforeEach(() => {
	vi.spyOn(console, 'error').mockImplementation(() => {});
	vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
	vi.restoreAllMocks();
	delete vars.DISCORD_WEBHOOK_URL;
});

describe('notifyOwner', () => {
	it('posts the count, court and topics only, and can never mention anyone', async () => {
		vars.DISCORD_WEBHOOK_URL = hook;
		const fetchSpy = vi
			.spyOn(globalThis, 'fetch')
			.mockResolvedValue(new Response(null, { status: 204 }));
		await notifyOwner(3, report);
		const [url, init] = fetchSpy.mock.calls[0];
		expect(url).toBe(hook);
		expect(JSON.parse(String(init?.body))).toEqual({
			content: notifyMessage(3, report),
			allowed_mentions: { parse: [] }
		});
		expect(notifyMessage(3, report)).toBe(
			'New court correction on net-time: Waveland Park Tennis Courts (surface, court count). 3 waiting for review: run `npm run corrections:review`.'
		);
	});

	it('does nothing when no webhook is configured', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch');
		await notifyOwner(1, report);
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it.each([
		'https://example.com/api/webhooks/1/x',
		'http://discord.com/api/webhooks/1/x',
		'https://discord.com.evil.example/api/webhooks/1/x',
		'https://discord.com/api/webhooks/1/x?wait=true&redirect=https://evil.example'
	])('refuses a webhook URL that isn’t Discord’s: %s', async (url) => {
		vars.DISCORD_WEBHOOK_URL = url;
		const fetchSpy = vi.spyOn(globalThis, 'fetch');
		await notifyOwner(1, report);
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it('never throws when Discord fails or is unreachable', async () => {
		vars.DISCORD_WEBHOOK_URL = hook;
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('no', { status: 429 }));
		await expect(notifyOwner(1, report)).resolves.toBeUndefined();
		vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
		await expect(notifyOwner(1, report)).resolves.toBeUndefined();
	});
});
