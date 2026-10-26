import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import adapter from '@sveltejs/adapter-cloudflare';
import { sveltekit } from '@sveltejs/kit/vite';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

// The one hand-written inline script (theme before first paint, src/app.html), allowed by hash.
const themeScript = readFileSync('src/app.html', 'utf8').match(/<script>(.*?)<\/script>/s)?.[1];
if (!themeScript) throw new Error('src/app.html: theme script not found');
const themeScriptHash: `sha256-${string}` = `sha256-${createHash('sha256').update(themeScript).digest('base64')}`;

export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter(),
			// Nonces for SSR, hashes for prerendered pages. Never add 'unsafe-inline'/'unsafe-eval' to script-src.
			// style-src allows inline because Svelte transitions and MapLibre set style attributes.
			csp: {
				mode: 'auto',
				directives: {
					'default-src': ['self'],
					// Third-party origins are added only when a feature uses them (Turnstile and
					// Cloudflare Web Analytics were removed until then; see /privacy).
					'script-src': ['self', themeScriptHash],
					'style-src': ['self', 'unsafe-inline'],
					// OpenFreeMap (map style, tiles, fonts, sprites): one origin, loaded only after "Show map".
					'img-src': ['self', 'data:', 'blob:', 'https://tiles.openfreemap.org'],
					'font-src': ['self'],
					'connect-src': ['self', 'https://tiles.openfreemap.org'],
					'frame-src': ['none'],
					'worker-src': ['self', 'blob:'],
					'object-src': ['none'],
					'base-uri': ['self'],
					'form-action': ['self'],
					'frame-ancestors': ['none']
				}
			}
		})
	],
	test: {
		expect: { requireAssertions: true },
		passWithNoTests: true,
		coverage: {
			provider: 'v8',
			// Unit coverage measures logic. Pages, components and DB queries are verified by
			// Playwright against the real Worker + Postgres (e2e/), which v8 can't instrument.
			include: ['src/**/*.ts'],
			exclude: [
				'src/**/*.d.ts',
				'src/**/*.e2e.ts',
				'src/test/**',
				'src/routes/**',
				'src/lib/server/db/**'
			],
			thresholds: {
				lines: 70,
				'src/lib/server/security/**': { lines: 90 }
			}
		},
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'client',
					browser: {
						enabled: true,
						provider: playwright(),
						instances: [{ browser: 'chromium', headless: true }]
					},
					include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
					exclude: ['src/lib/server/**']
				}
			},

			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					alias: {
						'cloudflare:workers': new URL('./src/test/cloudflare-workers.ts', import.meta.url)
							.pathname
					},
					include: ['src/**/*.{test,spec}.{js,ts}', 'scripts/**/*.{test,spec}.ts'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
