<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	type Props = HTMLButtonAttributes & {
		variant?: 'primary' | 'secondary' | 'plain';
		children: Snippet;
	};

	// type defaults to "button" so a Button never submits a form by accident.
	let { variant = 'primary', type = 'button', children, ...rest }: Props = $props();
</script>

<button {type} class={variant} {...rest}>{@render children()}</button>

<style>
	button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		min-height: var(--target);
		padding: 0 var(--space-5);
		border: 0;
		border-radius: var(--radius-card);
		font-size: var(--text-body);
		font-weight: 600;
		cursor: pointer;
		transition:
			opacity 0.15s var(--ease),
			transform 0.15s var(--ease);
	}

	button:active:not(:disabled) {
		opacity: 0.7;
		transform: scale(0.98);
	}

	button:disabled {
		cursor: not-allowed;
		opacity: 0.4;
	}

	.primary {
		background: var(--tint);
		color: var(--on-tint);
	}

	.secondary {
		background: var(--fill);
		color: var(--tint);
	}

	.plain {
		padding: 0 var(--space-2);
		background: transparent;
		color: var(--link);
		font-weight: 400;
	}
</style>
