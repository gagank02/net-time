// Field rules for anonymous corrections (planning/SPEC-submissions.md, "Security" 4 and 5).
// Everything here is hostile input until it passes; the database re-checks lengths and formats.
import { englishDataset, englishRecommendedTransformers, RegExpMatcher } from 'obscenity';
import { z } from 'zod';
import { addDays } from '#lib/courts/status.js';
import { correctionTopics } from '#lib/server/db/schema.js';
import { parseForm, type ParseResult } from '#lib/server/security/validate.js';

/** Hidden field people never see or fill in; a value means a bot (see the form action). */
export const honeypotField = 'company_fax';
export const turnstileField = 'cf-turnstile-response';

// If the data test in validate.test.ts flags a real place name, allow it with
// englishDataset.addPhrase(...) / a whitelisted term rather than weakening the check.
const profanity = new RegExpMatcher({
	...englishDataset.build(),
	...englishRecommendedTransformers
});

/**
 * NFKC (folds look-alike and full-width letters). Format characters (Unicode Cf: zero-width and
 * bidi overrides) are deleted, since they hide or reorder text and split words to dodge the filter;
 * control characters (line breaks, tabs, escapes) become spaces.
 */
export function normalizeText(s: string): string {
	return s
		.normalize('NFKC')
		.replace(/\p{Cf}/gu, '')
		.replace(/\p{Cc}/gu, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

/** Spelled-out letters ("f u c k", "s.h.i.t") joined, so the filter sees the word. */
const spacedLetters = /\b\p{L}(?:[\s.\-_*]+\p{L}\b){2,}/gu;

export function isOffensive(s: string): boolean {
	const joined = s.replace(spacedLetters, (run) => run.replace(/[^\p{L}]/gu, ''));
	return profanity.hasMatch(s) || profanity.hasMatch(joined);
}

const offensive = 'Please remove offensive language and try again.';
// Most spam is links, and visitors' links aren't taken at all.
const link =
	/https?:|www\.|\b[a-z0-9-]+\.(com|net|org|gov|edu|io|co|us|info|biz|xyz|ru|cn|top|site|online|link|app)\b/i;
/** For tampered requests (a field sent twice, a hidden field changed): no form shows these. */
export const tampered = 'Something went wrong sending that. Please reload the page and try again.';

// Every message below is shown to visitors: plain words, never the library's defaults.
const text = (max: number, missing: string) =>
	z
		.string(missing)
		.max(max * 2, `Keep it under ${max} characters.`)
		.transform(normalizeText);

const details = text(1000, 'Tell us what’s right.').pipe(
	z
		.string()
		.min(1, 'Tell us what’s wrong.')
		.max(1000, 'Keep it under 1,000 characters.')
		.refine((s) => !link.test(s), 'Please leave out web addresses. Just tell us what’s right.')
		.refine((s) => !/[<>]/.test(s), 'Please leave out the < and > symbols.')
		.refine((s) => !isOffensive(s), offensive)
);

const isoDay = /^\d{4}-\d{2}-\d{2}$/;
/** A real calendar day: rejects 2026-02-30 and similar, which Date would roll over. */
const isDay = (s: string) =>
	isoDay.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && addDays(s, 0) === s;

/**
 * Builds the form schema. `courts` is the built court list (data/*.json) and `today` the Chicago
 * date, both passed in so the rules stay pure. Unknown or repeated fields are rejected.
 */
export function correctionSchema(courts: Pick<ReadonlySet<string>, 'has'>, today: string) {
	return z.strictObject(
		{
			court: z.string(tampered).refine((s) => courts.has(s), 'Unknown court.'),
			// Checkboxes: one value arrives as a string, several as an array.
			topics: z.preprocess(
				(v) => (v === undefined ? [] : typeof v === 'string' ? [v] : v),
				z
					.array(
						z.enum(correctionTopics, 'Pick from the list.'),
						'Pick at least one thing that’s wrong.'
					)
					.min(1, 'Pick at least one thing that’s wrong.')
					.max(correctionTopics.length)
					.transform((t) => [...new Set(t)])
			),
			details,
			seen_on: z
				.string('Pick a date in the past year.')
				.optional()
				.transform((s) => s || undefined)
				.refine(
					(s) => s === undefined || (isDay(s) && s <= today && s >= addDays(today, -365)),
					'Pick a date in the past year.'
				),
			[honeypotField]: z.string(tampered).optional(),
			[turnstileField]: z.string(tampered).optional()
		},
		{ error: tampered }
	);
}

export type Correction = z.infer<ReturnType<typeof correctionSchema>>;

export function parseCorrection(
	form: FormData,
	courts: Pick<ReadonlySet<string>, 'has'>,
	today: string
): ParseResult<Correction> {
	return parseForm(correctionSchema(courts, today), form);
}
