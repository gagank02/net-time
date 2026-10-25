import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const pages = [
	{ name: 'home', path: '/' },
	{ name: 'data', path: '/data' },
	{ name: '404', path: '/no-such-page' },
	{ name: 'error', path: '/__e2e/throw' }
];

async function axe(page: Page) {
	const { violations } = await new AxeBuilder({ page })
		.withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
		.analyze();
	return violations.map((v) => `${v.impact} ${v.id}: ${v.nodes.map((n) => n.target).join(', ')}`);
}

for (const scheme of ['light', 'dark'] as const) {
	for (const { name, path } of pages) {
		test(`axe: ${name} page has no violations (${scheme})`, async ({ page }) => {
			await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
			await page.goto(path);
			expect(await axe(page)).toEqual([]);
		});
	}
}

test('keyboard: skip link is first, visible on focus, and moves focus to main', async ({
	page
}) => {
	await page.goto('/');
	await page.keyboard.press('Tab');
	const skip = page.getByRole('link', { name: 'Skip to content' });
	await expect(skip).toBeFocused();
	await expect(skip).toBeInViewport();

	await page.keyboard.press('Enter');
	await expect(page.locator('main')).toBeFocused();
});

test('keyboard: every interactive element is reachable with a visible focus ring', async ({
	page
}) => {
	await page.goto('/');
	const interactive = await page
		.locator('a[href], button, input:not([type="hidden"]), select, textarea')
		.count();

	const reached = new Set<string>();
	for (let i = 0; i < interactive + 2; i++) {
		await page.keyboard.press('Tab');
		const info = await page.evaluate(() => {
			const el = document.activeElement as HTMLElement | null;
			if (!el || el === document.body) return null;
			const style = getComputedStyle(el);
			return {
				key: el.outerHTML.slice(0, 120),
				ring: style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) >= 2
			};
		});
		if (!info) continue;
		expect(info.ring, `no visible focus ring on ${info.key}`).toBe(true);
		reached.add(info.key);
	}
	expect(reached.size).toBe(interactive);
});
