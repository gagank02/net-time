import { defineConfig } from '@playwright/test';

// BASE_URL runs the suite against a deployed Worker instead of a local preview.
const deployed = process.env.BASE_URL;

export default defineConfig({
	// Explicit so contexts that tests create themselves (no-JS checks) get it too.
	use: { baseURL: deployed ?? 'http://localhost:4173' },
	// E2E_ROUTES enables test-only routes (e.g. /__e2e/throw); never set in wrangler.jsonc.
	webServer: deployed
		? undefined
		: { command: 'npm run build && npm run preview -- --var E2E_ROUTES:1', port: 4173 },
	testMatch: '**/*.e2e.{ts,js}'
});
