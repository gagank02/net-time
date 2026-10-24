import { defineConfig } from '@playwright/test';

export default defineConfig({
	// E2E_ROUTES enables test-only routes (e.g. /__e2e/throw); never set in wrangler.jsonc.
	webServer: { command: 'npm run build && npm run preview -- --var E2E_ROUTES:1', port: 4173 },
	testMatch: '**/*.e2e.{ts,js}'
});
