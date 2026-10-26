<script lang="ts">
	import { describeStatus } from '#lib/courts/status.js';
	import type { Access, CourtStatus } from '#lib/courts/types.js';

	// status is null until the page hydrates (prerendered pages can't know the time).
	let {
		status,
		courtCount,
		access
	}: { status: CourtStatus | null; courtCount: number; access: Access } = $props();

	const text = $derived.by(() => {
		if (!status) return null;
		const { label, detail } = describeStatus(status, courtCount);
		// A single block's own title ("Pickleball open play") says more than "Class in progress".
		const named = status.state === 'class' && status.titles.length === 1 ? status.titles[0] : label;
		const booked = access === 'reservation' && status.state !== 'closed';
		return { label: booked ? `${named} · reservation required` : named, detail };
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
		<!-- The separator ends the label so a wrapped line never starts with "·". -->
		<span class="label">{text.label}<span class="sep" aria-hidden="true">·</span></span>
		<span class="detail">{text.detail}</span>
	</span>
{:else}
	<!-- Same line height as a real status, so nothing shifts when it fills in. -->
	<span class="status pending" aria-hidden="true">&nbsp;</span>
{/if}

<style>
	.status {
		display: inline-flex;
		flex-wrap: wrap;
		align-items: baseline;
		column-gap: var(--space-1);
		font-size: var(--text-subhead);
	}

	.icon {
		flex: none;
		align-self: center;
		width: 0.75rem;
		height: 0.75rem;
		margin-right: 2px;
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

	.sep {
		margin-left: 0.25em;
	}

	.sep,
	.detail {
		color: var(--label-2);
		font-weight: 400;
	}
</style>
