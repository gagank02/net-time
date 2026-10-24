export const themes = ['system', 'light', 'dark'] as const;
export type Theme = (typeof themes)[number];

export const themeCookie = 'theme';

/** Allowlist: anything unexpected (tampered cookie, missing) falls back to following the device. */
export function parseTheme(value: string | null | undefined): Theme {
	return themes.includes(value as Theme) ? (value as Theme) : 'system';
}
