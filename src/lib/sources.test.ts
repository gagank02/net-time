import { readdirSync, readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { datasetHosts, facilitySources } from './sources';

it('every website our data cites is credited on /data', () => {
	const credited = new Set([...datasetHosts, ...facilitySources.map((s) => s.host)]);
	const cited = new Set<string>();
	for (const file of readdirSync('data').filter((f) => f.endsWith('.json'))) {
		for (const url of readFileSync(`data/${file}`, 'utf8').match(/https:\/\/[^"\s]+/g) ?? [])
			cited.add(new URL(url).host);
	}
	expect([...cited].filter((host) => !credited.has(host))).toEqual([]);
	// And nothing credited that we no longer use.
	expect(facilitySources.map((s) => s.host).filter((host) => !cited.has(host))).toEqual([]);
});
