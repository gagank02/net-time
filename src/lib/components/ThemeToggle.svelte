<script lang="ts">
	import { onMount } from 'svelte';
	import { parseTheme, themeKey, themes, type Theme } from '#lib/theme.js';

	// Pages are static, so the choice lives in this browser (localStorage), applied before first
	// paint by app.html. "system" is the prerendered default; the real choice shows once mounted.
	let current = $state<Theme>('system');
	// Disabled until hydrated, so an early tap on the static page never silently does nothing.
	let ready = $state(false);
	onMount(() => {
		current = parseTheme(document.documentElement.dataset.theme);
		ready = true;
	});

	const labels: Record<Theme, string> = { system: 'System', light: 'Light', dark: 'Dark' };

	function choose(value: Theme) {
		current = value;
		document.documentElement.dataset.theme = value;
		try {
			if (value === 'system') localStorage.removeItem(themeKey);
			else localStorage.setItem(themeKey, value);
		} catch {
			// Storage blocked (private mode, policy): the choice lasts for this page only.
		}
	}
</script>

<!-- Needs JavaScript; hidden without it (see AppShell), where the device setting applies. -->
<div class="appearance" role="group" aria-label="Appearance">
	<span class="label" aria-hidden="true">Appearance</span>
	<div class="segmented">
		{#each themes as option (option)}
			<button
				type="button"
				aria-pressed={current === option}
				disabled={!ready}
				onclick={() => choose(option)}
			>
				{labels[option]}
			</button>
		{/each}
	</div>
</div>

<style>
	.appearance {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}

	.label {
		color: var(--label-2);
		font-size: var(--text-footnote);
	}

	/* iOS segmented control */
	.segmented {
		display: inline-flex;
		padding: 2px;
		border-radius: calc(var(--radius-control) + 1px);
		background: var(--fill);
	}

	button {
		min-width: 4.5rem;
		min-height: var(--target);
		padding: 0 var(--space-3);
		border: 0;
		border-radius: calc(var(--radius-control) - 1px);
		background: transparent;
		font-size: var(--text-footnote);
		font-weight: 500;
		cursor: pointer;
		transition: background-color 0.2s var(--ease);
	}

	button[aria-pressed='true'] {
		background: var(--fill-selected);
		font-weight: 600;
		box-shadow:
			0 3px 8px rgb(0 0 0 / 0.12),
			0 3px 1px rgb(0 0 0 / 0.04);
	}
</style>
