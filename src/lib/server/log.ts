// Structured JSON logs (Workers Logs parses one JSON object per line).
// Allowlist, not denylist: a field must be named here to be logged, so cookies, tokens,
// bodies, emails and raw locations can't slip in by accident.
const allowedFields = new Set([
	'requestId',
	'method',
	'route',
	'status',
	'ms',
	'kind',
	'bucket',
	'reason',
	'ipPrefix',
	'error'
]);

const email = /[^\s@"'<>]+@[^\s@"'<>]+\.[a-z]{2,}/gi;

/** Error name + stack (or message), with email-shaped strings redacted; DB errors can echo row values. */
export function describeError(error: unknown): string {
	const text =
		error instanceof Error ? (error.stack ?? `${error.name}: ${error.message}`) : String(error);
	return text.replace(email, '[email]').slice(0, 4000);
}

export function log(
	level: 'info' | 'warn' | 'error',
	event: string,
	fields: Record<string, unknown> = {}
): void {
	const entry: Record<string, unknown> = { level, event };
	for (const [key, value] of Object.entries(fields)) {
		if (allowedFields.has(key)) entry[key] = value;
	}
	const line = JSON.stringify(entry);
	if (level === 'error') console.error(line);
	else if (level === 'warn') console.warn(line);
	else console.log(line);
}
