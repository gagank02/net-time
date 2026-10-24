import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { maxFieldLength, parseForm } from './validate';

const Schema = z.object({
	name: z.string().trim().min(1, 'Required').max(100, 'Too long'),
	level: z.coerce.number().min(1).max(7)
});

function form(entries: [string, string][]) {
	const f = new FormData();
	for (const [k, v] of entries) f.append(k, v);
	return f;
}

describe('parseForm', () => {
	it('returns typed data for valid input', () => {
		const result = parseForm(
			Schema,
			form([
				['name', '  Serena  '],
				['level', '4.5']
			])
		);
		expect(result).toEqual({ ok: true, data: { name: 'Serena', level: 4.5 } });
	});

	it('returns field-level errors', () => {
		const result = parseForm(
			Schema,
			form([
				['name', ''],
				['level', '9']
			])
		);
		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.errors.name).toBe('Required');
			expect(result.errors.level).toBeTruthy();
		}
	});

	it('reports missing fields', () => {
		const result = parseForm(Schema, form([['name', 'A']]));
		expect(result.ok).toBe(false);
		if (!result.ok) expect(Object.keys(result.errors)).toEqual(['level']);
	});

	it('strips unknown fields (no mass assignment)', () => {
		const result = parseForm(
			Schema,
			form([
				['name', 'A'],
				['level', '3'],
				['role', 'admin'],
				['__proto__', 'x']
			])
		);
		expect(result).toEqual({ ok: true, data: { name: 'A', level: 3 } });
	});

	it('rejects strings over the schema max', () => {
		const result = parseForm(
			Schema,
			form([
				['name', 'x'.repeat(101)],
				['level', '3']
			])
		);
		expect(result).toEqual({ ok: false, errors: { name: 'Too long' } });
	});

	it('rejects any value over the hard cap before parsing', () => {
		const result = parseForm(
			z.object({ bio: z.string() }),
			form([['bio', 'x'.repeat(maxFieldLength + 1)]])
		);
		expect(result).toEqual({ ok: false, errors: { bio: 'Too long' } });
	});

	it('turns repeated keys into arrays', () => {
		const result = parseForm(
			z.object({ days: z.array(z.enum(['mon', 'tue'])) }),
			form([
				['days', 'mon'],
				['days', 'tue']
			])
		);
		expect(result).toEqual({ ok: true, data: { days: ['mon', 'tue'] } });
	});

	it('ignores file uploads', () => {
		const f = form([['name', 'A']]);
		f.append('avatar', new Blob(['x']), 'a.png');
		f.append('level', '2');
		expect(parseForm(Schema, f)).toEqual({ ok: true, data: { name: 'A', level: 2 } });
	});
});
