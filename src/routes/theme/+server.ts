import { redirect } from '@sveltejs/kit';
import { z } from 'zod';
import { safeRedirectPath } from '#lib/server/security/redirect.js';
import { parseForm } from '#lib/server/security/validate.js';
import { themeCookie, themes } from '#lib/theme.js';
import type { RequestHandler } from './$types';

const Schema = z.object({
	theme: z.enum(themes),
	redirectTo: z.string().max(2048).optional()
});

const oneYear = 60 * 60 * 24 * 365;

/** Saves the appearance choice. Plain form POST (no JS) redirects back; fetch callers get 204. */
export const POST: RequestHandler = async ({ request, cookies }) => {
	const parsed = parseForm(Schema, await request.formData());
	if (!parsed.ok) return new Response('Invalid theme', { status: 400 });

	cookies.set(themeCookie, parsed.data.theme, {
		path: '/',
		maxAge: oneYear,
		sameSite: 'lax',
		httpOnly: true
	});

	if (request.headers.get('accept') === 'application/json')
		return new Response(null, { status: 204 });
	redirect(303, safeRedirectPath(parsed.data.redirectTo));
};
