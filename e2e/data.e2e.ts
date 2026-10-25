import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

// The City of Chicago Data Terms of Use require this exact disclaimer on the site. Read it from the
// terms file kept in planning/ when present, else from the committed copy in data/README.md, so a
// reworded disclaimer in the app fails this test.
const official = (() => {
	for (const path of ['planning/chicago-data-terms-of-use.txt', 'data/README.md']) {
		try {
			const match = readFileSync(path, 'utf8').match(
				/“?(This site provides applications[^”"]+risk\.)/
			);
			if (match) return match[1].replace(/\s+/g, ' ');
		} catch {
			// try next
		}
	}
	throw new Error('Official disclaimer text not found');
})();

test('data page shows the City of Chicago disclaimer verbatim', async ({ page }) => {
	await page.goto('/data');
	const shown = (await page.getByTestId('chicago-disclaimer').textContent())!.replace(/\s+/g, ' ');
	expect(shown).toBe(official);
	await expect(
		page.getByRole('link', { name: /City of Chicago Data Terms of Use/ })
	).toHaveAttribute('href', 'https://www.chicago.gov/city/en/narr/foia/data_disclaimer.html');
});

for (const path of ['/', '/data', '/no-such-page']) {
	test(`footer links to the data disclaimer on ${path}`, async ({ page }) => {
		await page.goto(path);
		const link = page.locator('footer').getByRole('link', { name: 'Data sources and disclaimer' });
		await expect(link).toHaveAttribute('href', '/data');
	});
}
