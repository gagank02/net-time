<script lang="ts">
	/**
	 * Error summary shown at the top of a form after a failed submit. It takes focus so screen
	 * readers announce it, and each entry links to its field (ids follow TextField/Select's
	 * `field-${name}`). `labels` maps field name → human label; `_form` is a form-level error.
	 */
	let { errors, labels = {} }: { errors: Record<string, string>; labels?: Record<string, string> } =
		$props();

	let summary: HTMLDivElement | undefined = $state();
	const entries = $derived(Object.entries(errors));

	$effect(() => {
		if (entries.length) summary?.focus();
	});
</script>

{#if entries.length}
	<div
		class="summary"
		role="region"
		tabindex="-1"
		bind:this={summary}
		aria-labelledby="form-errors-title"
	>
		<h2 id="form-errors-title">There's a problem</h2>
		<ul role="list">
			{#each entries as [field, message] (field)}
				<li>
					{#if field === '_form'}
						{message}
					{:else}
						<a href="#field-{field}">{labels[field] ?? field}. {message}</a>
					{/if}
				</li>
			{/each}
		</ul>
	</div>
{/if}

<style>
	.summary {
		display: grid;
		gap: var(--space-2);
		padding: var(--space-4);
		border-left: 4px solid var(--danger);
		border-radius: var(--radius-card);
		background: var(--card);
	}

	h2 {
		font-size: var(--text-body);
		font-weight: 600;
	}

	ul {
		display: grid;
		gap: var(--space-1);
	}

	a {
		color: var(--danger);
		text-decoration: underline;
	}
</style>
