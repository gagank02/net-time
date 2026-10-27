<script lang="ts">
	import { describeStatus } from '#lib/courts/status.js';
	import type { Access, CourtStatus } from '#lib/courts/types.js';

	// status is null until the page hydrates (prerendered pages can't know the time).
	let {
		status,
		courtCount,
		access,
		seasonNote = null
	}: {
		status: CourtStatus | null;
		courtCount: number;
		access: Access;
		seasonNote?: string | null;
	} = $props();

	const text = $derived.by(() => {
		if (!status) return null;
		const { label, detail } = describeStatus(status, courtCount, seasonNote);
		const note = { free: '', reservation: ' · reservation required', fee: ' · fee to play' }[
			access
		];
		return { label: status.state === 'closed' ? label : label + note, detail };
	});
</script>

{#if status && text}
	<!-- Shape + text carry the status; colour is only a third cue (WCAG 1.4.1). -->
	<span class="status {status.state}">
		<svg class="icon" viewBox="0 0 12 12" aria-hidden="true">
			{#if status.state === 'open'}
				<circle cx="6" cy="6" r="5" />
			{:else if status.state === 'class'}
				<path d="M6 1a5 5 0 1 0 0 10z" />
				<circle cx="6" cy="6" r="4.25" fill="none" stroke-width="1.5" />
			{:else}
				<circle cx="6" cy="6" r="4.25" fill="none" stroke-width="1.5" />
			{/if}
		</svg>
		<span class="label">{text.label}<span class="visually-hidden">.</span></span>
		<span class="detail">{text.detail}</span>
	</span>
{:else}
	<!-- Always two lines (label, then detail), so nothing shifts when the real status fills in. -->
	<span class="status pending" aria-hidden="true">
		<span class="label">&nbsp;</span><span class="detail">&nbsp;</span>
	</span>
{/if}

<style>
	/* Label over detail, one line each: a fixed height before and after hydration (no layout shift). */
	.status {
		display: grid;
		grid-template-columns: 0.75rem minmax(0, 1fr);
		column-gap: var(--space-2);
		align-items: center;
		font-size: var(--text-subhead);
	}

	.label,
	.detail {
		grid-column: 2;
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
	}

	.icon {
		grid-row: 1;
		grid-column: 1;
		width: 0.75rem;
		height: 0.75rem;
	}

	.open .icon {
		fill: var(--tint);
	}

	.class .icon {
		fill: var(--amber);
		stroke: var(--amber);
	}

	.closed .icon {
		stroke: var(--label-2);
	}

	.label {
		font-weight: 600;
	}

	.open .label {
		color: var(--tint);
	}

	.detail {
		color: var(--label-2);
		font-weight: 400;
	}
</style>
