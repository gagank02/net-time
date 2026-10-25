<script lang="ts">
	import { onMount } from 'svelte';
	import type { Area } from '#lib/courts/types.js';

	let {
		areas,
		area,
		zip,
		usingDevice,
		locating,
		error,
		onlocate,
		onchoose
	}: {
		areas: Area[];
		area: string;
		zip: string;
		usingDevice: boolean;
		locating: boolean;
		error: string;
		onlocate: () => void;
		/** Called before the form submits a neighborhood/ZIP, so device location stops overriding it. */
		onchoose: () => void;
	} = $props();

	let areaSelect: HTMLSelectElement | undefined = $state();
	let hydrated = $state(false);
	onMount(() => (hydrated = true));

	// After a blocked/failed location request, move focus to the alternative.
	$effect(() => {
		if (error) areaSelect?.focus();
	});
</script>

<div class="near">
	<!-- Rendered on the server too (disabled until hydrated) so the list doesn't shift when JS loads. -->
	<button
		type="button"
		class="locate"
		onclick={onlocate}
		disabled={!hydrated || locating}
		aria-pressed={usingDevice}
	>
		<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M15 1 1 7.5l6 1.5 1.5 6z" /></svg>
		{locating ? 'Finding you…' : usingDevice ? 'Using your location' : 'Use my location'}
	</button>
	<p class="hint">
		Your location stays on this device. It's never sent or saved.
		<noscript>Using your location needs JavaScript.</noscript>
	</p>
	<p class="or" aria-hidden="true">or</p>

	<div class="pickers">
		<div class="field">
			<label for="area">Neighborhood</label>
			<select
				id="area"
				name="area"
				bind:this={areaSelect}
				value={area}
				onchange={(e) => {
					onchoose();
					e.currentTarget.form?.requestSubmit();
				}}
			>
				<option value="">Any</option>
				{#each areas as a (a.slug)}
					<option value={a.slug}>{a.name}</option>
				{/each}
			</select>
		</div>
		<div class="field zip">
			<label for="zip">ZIP</label>
			<div class="zip-row">
				<input
					id="zip"
					name="zip"
					inputmode="numeric"
					autocomplete="postal-code"
					pattern={'[0-9]{5}'}
					maxlength="5"
					value={zip}
					aria-describedby={error ? 'near-error' : undefined}
				/>
				<button type="submit" onclick={onchoose}>Go</button>
			</div>
		</div>
	</div>

	{#if error}
		<p id="near-error" class="error" role="alert">{error}</p>
	{/if}
</div>

<style>
	.near {
		display: grid;
		gap: var(--space-2);
		padding: var(--space-4);
		border-radius: var(--radius-card);
		background: var(--card);
	}

	.locate {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		min-height: var(--target);
		border: 0;
		border-radius: var(--radius-card);
		background: var(--tint);
		color: var(--on-tint);
		font-size: var(--text-body);
		font-weight: 600;
		cursor: pointer;
	}

	.locate:disabled {
		opacity: 0.6;
	}

	.locate svg {
		width: 1rem;
		height: 1rem;
		fill: currentColor;
	}

	.hint,
	.or {
		color: var(--label-2);
		font-size: var(--text-footnote);
		text-align: center;
	}

	.pickers {
		display: grid;
		grid-template-columns: 1fr 8.5rem;
		gap: var(--space-3);
	}

	.field {
		display: grid;
		gap: var(--space-1);
	}

	label {
		padding: 0 var(--space-1);
		font-size: var(--text-subhead);
		font-weight: 500;
	}

	select,
	input {
		width: 100%;
		min-width: 0;
		min-height: var(--target);
		padding: 0 var(--space-3);
		border: 1px solid transparent;
		border-radius: var(--radius-control);
		background: var(--fill);
		font-size: var(--text-body);
	}

	.zip-row {
		display: flex;
		gap: var(--space-1);
	}

	.zip-row button {
		min-width: var(--target);
		min-height: var(--target);
		border: 0;
		border-radius: var(--radius-control);
		background: var(--fill);
		color: var(--link);
		font-weight: 600;
		cursor: pointer;
	}

	.error {
		color: var(--danger);
		font-size: var(--text-footnote);
	}
</style>
