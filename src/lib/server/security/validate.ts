import type { z } from 'zod';

/** Hard cap on any single form value, before schema checks: bounds memory and regex work. */
export const maxFieldLength = 10_000;

export type ParseResult<T> = { ok: true; data: T } | { ok: false; errors: Record<string, string> };

/**
 * Validates FormData against a Zod object schema. Unknown fields are stripped (Zod's default),
 * repeated keys become arrays, files are ignored. Errors map field name → first message.
 */
export function parseForm<S extends z.ZodType>(schema: S, form: FormData): ParseResult<z.infer<S>> {
	const input: Record<string, string | string[]> = {};
	for (const key of new Set(form.keys())) {
		const values = form.getAll(key).filter((v): v is string => typeof v === 'string');
		if (values.some((v) => v.length > maxFieldLength)) {
			return { ok: false, errors: { [key]: 'Too long' } };
		}
		if (values.length) input[key] = values.length === 1 ? values[0] : values;
	}

	const result = schema.safeParse(input);
	if (result.success) return { ok: true, data: result.data };

	const errors: Record<string, string> = {};
	for (const issue of result.error.issues) {
		const field = String(issue.path[0] ?? '_form');
		errors[field] ??= issue.message;
	}
	return { ok: false, errors };
}
