<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { themes, type Theme } from '#lib/theme.js';

	let { theme }: { theme: Theme } = $props();

	// Writable derived: follows the server value, overridden locally on click.
	let current = $derived(theme);

	const labels: Record<Theme, string> = { system: 'System', light: 'Light', dark: 'Dark' };

	// Progressive enhancement: without JS the form posts and redirects back.
	// With JS, switch instantly and save in the background.
	async function choose(event: SubmitEvent) {
		const value = (event.submitter as HTMLButtonElement | null)?.value as Theme | undefined;
		if (!value) return;
		event.preventDefault();
		current = value;
		document.documentElement.dataset.theme = value;
		const body = new FormData();
		body.set('theme', value);
		await fetch(resolve('/theme'), {
			method: 'POST',
			body,
			headers: { accept: 'application/json' }
		}).catch(() => {});
	}
</script>

<form method="POST" action={resolve('/theme')} onsubmit={choose} aria-label="Appearance">
	<input type="hidden" name="redirectTo" value={page.url.pathname + page.url.search} />
	<span class="label" aria-hidden="true">Appearance</span>
	<div class="segmented">
		{#each themes as option (option)}
			<button type="submit" name="theme" value={option} aria-pressed={current === option}>
				{labels[option]}
			</button>
		{/each}
	</div>
</form>

<style>
	form {
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
