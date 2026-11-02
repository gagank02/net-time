// Makes visitor text safe to print in a terminal. Without this, a report could carry escape
// sequences that move the cursor, rewrite earlier lines, retitle the window, or plant a clickable
// hyperlink (OSC 8). Used by scripts/review-corrections.ts on everything a visitor sent.
const escapes =
	// CSI (ESC [ ... final), OSC (ESC ] ... BEL or ESC \), other two-character ESC sequences, and
	// the 8-bit forms of CSI (0x9b) and OSC (0x9d, ended by BEL or ST 0x9c).
	// eslint-disable-next-line no-control-regex -- matching control characters is the point
	/\x1b(?:\[[0-?]*[ -/]*[@-~]|\][^\x07\x1b]*(?:\x07|\x1b\\)?|[@-Z\\-_])|\x9b[0-?]*[ -/]*[@-~]|\x9d[^\x07\x9c]*[\x07\x9c]?/g;

export function terminalSafe(text: string): string {
	return text
		.replace(escapes, '')
		.replace(/\p{Cf}/gu, '') // zero-width and bidi overrides
		.replace(/\p{Cc}/gu, ' '); // any other control character, incl. bare ESC, CR, C1 (0x80–0x9f)
}
