import { expect, test, type Page } from './fixtures';

async function openAt(page: Page, path: string, iso: string) {
	await page.clock.setFixedTime(new Date(iso));
	await page.goto(path);
}

const fact = (page: Page, term: string) =>
	page
		.locator('dl > div')
		.filter({ has: page.locator('dt', { hasText: term }) })
		.locator('dd');

test('Maggie Daley: facts, hours with today, merged class schedule, sources', async ({ page }) => {
	await openAt(page, '/courts/maggie-daley-park', '2026-10-26T10:00:00-05:00'); // Monday 10 AM
	await expect(page).toHaveTitle('Maggie Daley Park tennis courts · net-time');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Maggie Daley Park');
	await expect(page.getByText('Pickleball open play (courts 1–5)').first()).toBeVisible();

	await expect(fact(page, 'Courts')).toHaveText('6');
	await expect(fact(page, 'Lights')).toHaveText('Yes');
	await expect(fact(page, 'Access')).toContainText('Free, first come first served');

	const today = page.getByRole('row', { name: /Monday/ });
	await expect(today).toHaveAttribute('aria-current', 'date');
	await expect(today).toContainText('7 AM – 9 PM');
	await expect(page.getByRole('link', { name: /Hours source/ })).toHaveAttribute(
		'href',
		'https://www.maggiedaleypark.com/things-to-do-see/tennis-courts'
	);

	// 7 weekday rows collapse into two lines.
	await expect(page.getByText('Mon–Fri · 9 AM – Noon')).toBeVisible();
	await expect(page.getByText('Sat–Sun · 9 AM – Noon')).toBeVisible();
	await expect(page.getByText('Uses 5 of 6 courts')).toBeVisible();
	await expect(page.getByText('Uses 1 of 6 courts')).toBeVisible();
});

test('McFetridge: reservation access with a booking link in a new tab', async ({ page }) => {
	await openAt(page, '/courts/mcfetridge-sports-center', '2026-10-26T13:00:00-05:00');
	await expect(fact(page, 'Setting')).toHaveText('Indoor');
	await expect(fact(page, 'Access')).toContainText('Paid, reservation required');
	const book = page.getByRole('link', { name: /Book court time/ });
	await expect(book).toHaveAttribute(
		'href',
		'https://www.mcfetridgesportscenter.com/tennis/book-court-time'
	);
	await expect(book).toHaveAttribute('target', '_blank');
	await expect(page.getByText('Open now · reservation required')).toBeVisible();
});

test('default-hours park: standard hours note, unknowns shown honestly, directions open in new tabs', async ({
	page
}) => {
	await openAt(page, '/courts/oz-park', '2026-10-26T13:00:00-05:00');
	await expect(page.getByText('Standard Chicago Park District hours')).toBeVisible();
	await expect(fact(page, 'Lights')).toHaveText('Not known');
	for (const name of [/Apple Maps/, /Google Maps/]) {
		const link = page.getByRole('link', { name });
		await expect(link).toHaveAttribute('target', '_blank');
		await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
	}
	await expect(page.getByRole('link', { name: /Google Maps/ })).toHaveAttribute(
		'href',
		/destination=41\.\d+%2C-87\.\d+/
	);
	await expect(page.getByText(/Last checked \w{3} \d+, 2026/)).toBeVisible();
});

test('list rows link to their detail page and back', async ({ page }) => {
	await page.goto('/courts');
	await page.getByRole('link', { name: /^Oz Park/ }).click();
	await expect(page).toHaveURL(/\/courts\/oz-park$/);
	await page.getByRole('link', { name: '‹ All courts' }).click();
	await expect(page).toHaveURL(/\/courts$/);
});

for (const path of [
	'/courts/no-such-park',
	'/courts/Oz%20Park',
	"/courts/oz-park'--",
	'/courts/' + 'a'.repeat(81)
]) {
	test(`unknown or malformed slug → 404: ${path.slice(0, 40)}`, async ({ page }) => {
		const res = await page.goto(path);
		expect(res?.status()).toBe(404);
		await expect(page.getByRole('heading', { level: 1 })).toHaveText('Page not found');
	});
}
