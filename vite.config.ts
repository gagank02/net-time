import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import adapter from '@sveltejs/adapter-cloudflare';
import { sveltekit } from '@sveltejs/kit/vite';

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
					'script-src': [
						'self',
						'https://challenges.cloudflare.com',
						'https://static.cloudflareinsights.com'
					],
					'style-src': ['self', 'unsafe-inline'],
					// OpenFreeMap (map style, tiles, fonts, sprites): one origin, loaded only after "Show map".
					'img-src': ['self', 'data:', 'blob:', 'https://tiles.openfreemap.org'],
					'font-src': ['self'],
					'connect-src': [
						'self',
						'https://cloudflareinsights.com',
						'https://tiles.openfreemap.org'
					],
					'frame-src': ['https://challenges.cloudflare.com'],
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
			include: ['src/**/*.{ts,svelte}'],
			exclude: ['src/**/*.d.ts', 'src/**/*.e2e.ts']
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
