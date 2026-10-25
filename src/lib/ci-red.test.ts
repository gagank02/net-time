import { expect, test } from 'vitest';

test('deliberately fails to prove CI blocks', () => {
	expect(1).toBe(2);
});
