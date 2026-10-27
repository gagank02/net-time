import { defineConfig, devices } from '@playwright/test';

// BASE_URL runs the suite against a deployed Worker instead of a local preview.
const deployed = process.env.BASE_URL;

// What a visitor sees and taps; header, CSRF, error and rate-limit checks don't depend on the device.
const pageTests =
	/(a11y|courts|court-detail|data|links|map|mobile|near-me|privacy|theme)\.e2e\.ts$/;

export default defineConfig({
	// Explicit so contexts that tests create themselves (no-JS checks) get it too.
	use: { baseURL: deployed ?? 'http://localhost:4173' },
	// E2E_ROUTES enables test-only routes (e.g. /__e2e/throw); never set in wrangler.jsonc.
	webServer: deployed
		? undefined
		: { command: 'npm run build && npm run preview -- --var E2E_ROUTES:1', port: 4173 },
	testMatch: '**/*.e2e.{ts,js}',
	projects: [
		{ name: 'desktop', use: { ...devices['Desktop Chrome'] }, testIgnore: '**/mobile.e2e.ts' },
		// Safari's engine at iPhone size, and Chrome at Android size.
		{ name: 'iphone', use: { ...devices['iPhone 15'] }, testMatch: pageTests },
		{ name: 'android', use: { ...devices['Pixel 7'] }, testMatch: pageTests }
	]
});
