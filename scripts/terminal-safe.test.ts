import { expect, it } from 'vitest';
import { terminalSafe } from './terminal-safe.ts';

it.each([
	['colors and cursor moves', 'ok\x1b[31mred\x1b[2J\x1b[1A', 'okred'],
	['window title (OSC)', '\x1b]0;pwned\x07hi', 'hi'],
	['hyperlink (OSC 8)', '\x1b]8;;https://evil.example\x1b\\click\x1b]8;;\x1b\\', 'click'],
	['carriage return overwrite', 'fine\rEVIL', 'fine EVIL'],
	['8-bit CSI', 'a\x9b2Jb', 'ab'],
	['8-bit OSC', 'a\x9d0;title\x9cb', 'ab'],
	['bare escape', 'a\x1bb', 'a b'],
	['bidi override', 'abc‮def', 'abcdef'],
	['backspaces', 'secret\b\b\b\b\b\bpublic', 'secret      public']
])('removes %s', (_, input, expected) => {
	expect(terminalSafe(input)).toBe(expected);
});

it('leaves ordinary text, accents and emoji alone', () => {
	const s = 'Courts close at 9 PM — café, “quotes”, 🎾';
	expect(terminalSafe(s)).toBe(s);
});
