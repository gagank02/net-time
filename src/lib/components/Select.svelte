<script lang="ts">
	import type { HTMLSelectAttributes } from 'svelte/elements';

	type Props = Omit<HTMLSelectAttributes, 'value'> & {
		label: string;
		name: string;
		options: { value: string; label: string }[];
		value?: string;
		/** From parseForm's `errors[name]`. */
		error?: string;
		hint?: string;
	};

	let { label, name, options, value = $bindable(''), error, hint, id, ...rest }: Props = $props();

	const fieldId = $derived(id ?? `field-${name}`);
	const describedBy = $derived(
		[error && `${fieldId}-error`, hint && `${fieldId}-hint`].filter(Boolean).join(' ') || undefined
	);
</script>

<div class="field">
	<label for={fieldId}>{label}</label>
	<select
		id={fieldId}
		{name}
		bind:value
		aria-invalid={error ? 'true' : undefined}
		aria-describedby={describedBy}
		{...rest}
	>
		{#each options as option (option.value)}
			<option value={option.value}>{option.label}</option>
		{/each}
	</select>
	{#if hint}<p class="hint" id="{fieldId}-hint">{hint}</p>{/if}
	{#if error}<p class="error" id="{fieldId}-error">{error}</p>{/if}
</div>

<style>
	.field {
		display: grid;
		gap: var(--space-1);
	}

	label {
		padding: 0 var(--space-1);
		font-size: var(--text-subhead);
		font-weight: 500;
	}

	select {
		min-height: var(--target);
		padding: 0 var(--space-3);
		border: 1px solid transparent;
		border-radius: var(--radius-control);
		background: var(--fill);
		font-size: var(--text-body);
	}

	select[aria-invalid='true'] {
		border-color: var(--danger);
	}

	.hint,
	.error {
		padding: 0 var(--space-1);
		font-size: var(--text-footnote);
	}

	.hint {
		color: var(--label-2);
	}

	.error {
		color: var(--danger);
	}
</style>
