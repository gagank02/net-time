import { describe, expect, it } from 'vitest';
import areas from '../../../../data/areas.seed.json';
import cityClasses from '../../../../data/classes.cpd.json';
import handClasses from '../../../../data/classes.seed.json';
import curation from '../../../../data/courts.curation.json';
import courts from '../../../../data/courts.seed.json';
import { isOffensive, normalizeText, parseCorrection } from './validate';

const known = new Set(['mcfetridge-sports-center', 'waveland-park']);
const today = '2026-10-27';

function parse(fields: Record<string, string | string[]>) {
	const form = new FormData();
	const base = { court: 'waveland-park', topics: 'hours', details: 'Courts close at 9 PM now.' };
	for (const [k, v] of Object.entries({ ...base, ...fields })) {
		for (const one of [v].flat()) form.append(k, one);
	}
	return parseCorrection(form, known, today);
}

const errorFor = (fields: Record<string, string | string[]>) => {
	const r = parse(fields);
	return r.ok ? undefined : r.errors;
};

describe('normalizeText', () => {
	it('removes zero-width, bidi and control characters and folds look-alikes', () => {
		expect(normalizeText('clo​ses‮ at\u0007 9\n\n PM ')).toBe('closes at 9 PM');
		expect(normalizeText('ｃｌａｙ')).toBe('clay');
	});
});

describe('parseCorrection', () => {
	it('accepts a plain report and drops empty optional fields', () => {
		const r = parse({ seen_on: '' });
		expect(r).toEqual({
			ok: true,
			data: { court: 'waveland-park', topics: ['hours'], details: 'Courts close at 9 PM now.' }
		});
	});

	it('accepts a recent date', () => {
		const r = parse({ seen_on: today });
		expect(r.ok && r.data.seen_on).toBe(today);
	});

	it.each([
		['unknown court', { court: 'nowhere' }, 'court'],
		['bad topic', { topics: 'prices' }, 'topics'],
		['one bad topic among good', { topics: ['hours', 'prices'] }, 'topics'],
		['no topic', { topics: [] }, 'topics'],
		['empty details', { details: ' ​ ' }, 'details'],
		['details over 1,000', { details: 'a'.repeat(1001) }, 'details'],
		['link in details', { details: 'see chicagoparkdistrict.com' }, 'details'],
		['url in details', { details: 'see https://x.example' }, 'details'],
		['html in details', { details: '<img src=x onerror=alert(1)>' }, 'details'],
		['repeated field', { details: ['one', 'two'] }, 'details'],
		['future date', { seen_on: '2026-10-28' }, 'seen_on'],
		['date over a year ago', { seen_on: '2025-10-26' }, 'seen_on'],
		['impossible date', { seen_on: '2026-02-30' }, 'seen_on'],
		['not a date', { seen_on: 'yesterday' }, 'seen_on']
	])('rejects %s', (_, fields, field) => {
		expect(errorFor(fields)).toHaveProperty(field);
	});

	it('accepts several topics and drops repeats', () => {
		const r = parse({ topics: ['hours', 'lights', 'hours'] });
		expect(r.ok && r.data.topics).toEqual(['hours', 'lights']);
	});

	it('rejects unknown fields', () => {
		expect(errorFor({ email: 'a@b.co' })).toHaveProperty('_form');
	});

	it.each(['this is f*cking wrong', 'sh1t hours', 'f u c k', 's.h.i.t', 'ｆｕｃｋ', 'b​itch'])(
		'rejects offensive details: %s',
		(details) => {
			expect(errorFor({ details })?.details).toBe(
				'Please remove offensive language and try again.'
			);
		}
	);

	it('rejects a source link field: links are not taken at all', () => {
		expect(errorFor({ source_url: 'https://www.chicagoparkdistrict.com/' })).toHaveProperty(
			'_form'
		);
	});
});

describe('isOffensive false positives', () => {
	it('passes ordinary tennis reports', () => {
		for (const s of [
			'Hard court resurfaced, now clay',
			'Lights out on court 3',
			'Class moved to Saturday at 9 AM',
			'Assessment day, courts closed',
			'Nets missing on 2 of 6 courts'
		]) {
			expect(isOffensive(s), s).toBe(false);
		}
	});

	it('passes every place name, address and class title in our data', () => {
		const names = [
			...courts.locations.flatMap((l) => [l.name, l.address ?? '', l.communityArea]),
			...areas.communityAreas.map((a) => a.name),
			...[...cityClasses.classes, ...handClasses.classes].map((c) => c.title),
			...curation.corrections.flatMap((c) => ('name' in c && c.name ? [c.name] : []))
		].filter(Boolean);
		expect(names.length).toBeGreaterThan(300);
		expect(names.filter(isOffensive)).toEqual([]);
	});
});
