export const themes = ['system', 'light', 'dark'] as const;
export type Theme = (typeof themes)[number];

/** localStorage key. Read before first paint by the inline script in app.html (keep in sync). */
export const themeKey = 'theme';

/** Allowlist: anything unexpected (tampered storage, missing) falls back to following the device. */
export function parseTheme(value: string | null | undefined): Theme {
	return themes.includes(value as Theme) ? (value as Theme) : 'system';
}
