import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';

// OWASP A03 (injection): every query goes through Drizzle's builder or its sql`` tag, both of
// which bind values as parameters. These escape hatches put text straight into SQL, so app code
// may not use them; a reviewed exception would need to be added here deliberately.
const banned = [/sql\.raw\(/, /\.query\(/, /\.unsafe\(/];

function files(dir: string): string[] {
	return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
		e.isDirectory()
			? files(join(dir, e.name))
			: /\.(ts|svelte)$/.test(e.name)
				? [join(dir, e.name)]
				: []
	);
}

it('app code never builds SQL from strings', () => {
	const offenders = files('src')
		.filter((f) => !/\.test\.ts$|\.e2e\.ts$/.test(f))
		.flatMap((f) => {
			const text = readFileSync(f, 'utf8');
			return banned.filter((re) => re.test(text)).map((re) => `${f}: ${re.source}`);
		});
	expect(offenders).toEqual([]);
});
