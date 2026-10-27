<script lang="ts">
	import { onMount } from 'svelte';
	import { parseTheme, themeKey } from '#lib/theme.js';

	// Pages are static, so the choice lives in this browser (localStorage), applied before first
	// paint by app.html. CSS picks the icon from that, so it is right before hydration too.
	let dark = $state<boolean | undefined>(undefined);
	const device = () => matchMedia('(prefers-color-scheme: dark)');

	function sync() {
		const theme = parseTheme(document.documentElement.dataset.theme);
		dark = theme === 'system' ? device().matches : theme === 'dark';
	}

	// Disabled until hydrated (dark is set), so an early tap on the static page never does nothing.
	onMount(() => {
		sync();
		const query = device();
		query.addEventListener('change', sync);
		return () => query.removeEventListener('change', sync);
	});

	function toggle() {
		const next = dark ? 'light' : 'dark';
		// Matching the device again means following it again, so a later device change applies.
		const theme = (next === 'dark') === device().matches ? 'system' : next;
		document.documentElement.dataset.theme = theme;
		try {
			if (theme === 'system') localStorage.removeItem(themeKey);
			else localStorage.setItem(themeKey, theme);
		} catch {
			// Storage blocked (private mode, policy): the choice lasts for this page only.
		}
		sync();
	}
</script>

<!-- Needs JavaScript; hidden without it (see AppShell), where the device setting applies. -->
<button
	type="button"
	class="theme"
	aria-label="Dark appearance"
	aria-pressed={dark}
	disabled={dark === undefined}
	onclick={toggle}
>
	<svg class="moon" viewBox="0 0 24 24" aria-hidden="true">
		<path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11Z" />
	</svg>
	<svg class="sun" viewBox="0 0 24 24" aria-hidden="true">
		<circle cx="12" cy="12" r="4.5" />
		<path
			d="M12 1.5v2.5M12 20v2.5M1.5 12H4M20 12h2.5M4.6 4.6l1.8 1.8M17.6 17.6l1.8 1.8M4.6 19.4l1.8-1.8M17.6 6.4l1.8-1.8"
		/>
	</svg>
</button>

<style>
	.theme {
		display: inline-grid;
		place-items: center;
		width: var(--target);
		height: var(--target);
		border: 0;
		border-radius: var(--radius-control);
		background: transparent;
		color: var(--label);
		cursor: pointer;
	}

	.theme:hover {
		background: var(--fill);
	}

	svg {
		width: 1.25rem;
		height: 1.25rem;
		fill: none;
		stroke: currentColor;
		stroke-width: 2;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	/* Light: moon (tap for dark). Dark: sun (tap for light). */
	.sun,
	:global(html[data-theme='dark']) .moon {
		display: none;
	}

	:global(html[data-theme='dark']) .sun {
		display: block;
	}

	@media (prefers-color-scheme: dark) {
		:global(html[data-theme='system']) .moon {
			display: none;
		}

		:global(html[data-theme='system']) .sun {
			display: block;
		}
	}
</style>
