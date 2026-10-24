import { expect, test } from '@playwright/test';

// SvelteKit's origin check (production builds only, so this runs against preview) rejects
// cross-site POST/PUT/PATCH/DELETE with a form content type before any route code runs.
// These are the content types a browser can send cross-site without a CORS preflight.
const formBodies = [
	{ type: 'application/x-www-form-urlencoded', data: 'a=1' },
	{
		type: 'multipart/form-data; boundary=x',
		data: '--x\r\nContent-Disposition: form-data; name="a"\r\n\r\n1\r\n--x--\r\n'
	},
	{ type: 'text/plain', data: 'a=1' }
];

for (const { type, data } of formBodies) {
	test(`cross-site ${type.split(';')[0]} POST is rejected with 403`, async ({ request }) => {
		const res = await request.post('/', {
			headers: { origin: 'https://evil.example', 'content-type': type },
			data
		});
		expect(res.status()).toBe(403);
		expect(await res.text()).toContain('Cross-site POST form submissions are forbidden');
	});
}

test('form POST with no Origin header is rejected', async ({ request }) => {
	const res = await request.fetch('/', {
		method: 'POST',
		headers: { 'content-type': 'application/x-www-form-urlencoded', origin: '' },
		data: 'a=1'
	});
	expect(res.status()).toBe(403);
});

test('same-origin form POST is not blocked by CSRF', async ({ request, baseURL }) => {
	const origin = new URL(baseURL ?? 'http://localhost:4173').origin;
	const res = await request.post('/', {
		headers: { origin, 'content-type': 'application/x-www-form-urlencoded' },
		data: 'a=1'
	});
	// No action on `/` yet, so not 2xx, but crucially not the CSRF 403.
	expect(res.status()).not.toBe(403);
});
