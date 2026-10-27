import { expect, test } from './fixtures';

const pages = ['/', '/courts', '/courts/oz-park', '/data', '/privacy'];

for (const path of pages) {
	test(`${path} fits the phone screen and has thumb-size tap targets`, async ({ page }) => {
		await page.goto(path);
		const overflow = await page.evaluate(
			() => document.documentElement.scrollWidth - document.documentElement.clientWidth
		);
		expect(overflow, 'page scrolls sideways').toBeLessThanOrEqual(0);

		// Apple HIG minimum hit area: 44×44 pt. Inline text links are exempt (they wrap in prose).
		const small = await page
			.locator('button:visible, input:visible, select:visible, nav a:visible')
			.evaluateAll((els) =>
				els
					.map((el) => ({ el, r: el.getBoundingClientRect() }))
					.filter(({ r }) => r.height < 44 || r.width < 44)
					.map(
						({ el, r }) =>
							`${el.outerHTML.slice(0, 80)} (${Math.round(r.width)}×${Math.round(r.height)})`
					)
			);
		expect(small).toEqual([]);
	});
}
