<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';

	type Props = Omit<HTMLInputAttributes, 'value'> & {
		label: string;
		name: string;
		value?: string;
		/** From parseForm's `errors[name]`. */
		error?: string;
		hint?: string;
	};

	let {
		label,
		name,
		value = $bindable(''),
		error,
		hint,
		id,
		type = 'text',
		...rest
	}: Props = $props();

	// Predictable id so FormErrors can link straight to the field.
	const fieldId = $derived(id ?? `field-${name}`);
	const describedBy = $derived(
		[error && `${fieldId}-error`, hint && `${fieldId}-hint`].filter(Boolean).join(' ') || undefined
	);
</script>

<div class="field">
	<label for={fieldId}>{label}</label>
	<input
		id={fieldId}
		{name}
		{type}
		bind:value
		aria-invalid={error ? 'true' : undefined}
		aria-describedby={describedBy}
		{...rest}
	/>
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

	input {
		min-height: var(--target);
		padding: 0 var(--space-3);
		border: 1px solid transparent;
		border-radius: var(--radius-control);
		background: var(--fill);
		font-size: var(--text-body); /* ≥16px stops iOS zooming on focus */
	}

	input[aria-invalid='true'] {
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
