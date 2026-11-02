import { env } from 'cloudflare:workers';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { notifyMessage, notifyOwner } from './notify';

const vars = env as unknown as Record<string, unknown>;
const hook = 'https://discord.com/api/webhooks/123456/abc-DEF_789';

beforeEach(() => {
	vi.spyOn(console, 'error').mockImplementation(() => {});
	vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
	vi.restoreAllMocks();
	delete vars.DISCORD_WEBHOOK_URL;
});

describe('notifyOwner', () => {
	it('posts only a count, and can never mention anyone', async () => {
		vars.DISCORD_WEBHOOK_URL = hook;
		const fetchSpy = vi
			.spyOn(globalThis, 'fetch')
			.mockResolvedValue(new Response(null, { status: 204 }));
		await notifyOwner(3);
		const [url, init] = fetchSpy.mock.calls[0];
		expect(url).toBe(hook);
		expect(JSON.parse(String(init?.body))).toEqual({
			content: notifyMessage(3),
			allowed_mentions: { parse: [] }
		});
		expect(notifyMessage(3)).toMatch(/^New court correction on net-time\. 3 waiting/);
	});

	it('does nothing when no webhook is configured', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch');
		await notifyOwner(1);
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
		await notifyOwner(1);
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it('never throws when Discord fails or is unreachable', async () => {
		vars.DISCORD_WEBHOOK_URL = hook;
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('no', { status: 429 }));
		await expect(notifyOwner(1)).resolves.toBeUndefined();
		vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
		await expect(notifyOwner(1)).resolves.toBeUndefined();
	});
});
