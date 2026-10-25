<script lang="ts">
	import { describeStatus } from '#lib/courts/status.js';
	import type { Access, CourtStatus } from '#lib/courts/types.js';

	let { status, courtCount, access }: { status: CourtStatus; courtCount: number; access: Access } =
		$props();

	const text = $derived.by(() => {
		const { label, detail } = describeStatus(status, courtCount);
		// A single block's own title ("Pickleball open play") says more than "Class in progress".
		const named = status.state === 'class' && status.titles.length === 1 ? status.titles[0] : label;
		const booked = access === 'reservation' && status.state !== 'closed';
		return { label: booked ? `${named} · reservation required` : named, detail };
	});
</script>

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
	<span class="label">{text.label}</span>
	<span class="detail">· {text.detail}</span>
</span>

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

	.detail {
		color: var(--label-2);
	}
</style>
