<script lang="ts">
	import ExternalLink from '#lib/components/ExternalLink.svelte';
	import type { CourtDetail } from '#lib/courts/types.js';

	// The court's listed facts: shown on its page and, for comparison, on its correction form.
	let { court }: { court: CourtDetail } = $props();

	const yesNo = (v: boolean | null) => (v === null ? 'Not known' : v ? 'Yes' : 'No');
	const surfaces = { hard: 'Hard court', clay: 'Clay', grass: 'Grass', other: 'Other' } as const;
</script>

<dl class="card facts">
	<div>
		<dt>Courts</dt>
		<dd>{court.courtCount}</dd>
	</div>
	<div>
		<dt>Setting</dt>
		<dd>{court.indoor ? 'Indoor' : 'Outdoor'}</dd>
	</div>
	<div>
		<dt>Lights</dt>
		<dd>{yesNo(court.lights)}</dd>
	</div>
	<div>
		<dt>Surface</dt>
		<!-- Unknown surfaces show as hard, as nearly all Park District courts are; the data keeps
		     them null so corrections can confirm them. -->
		<dd>{surfaces[court.surface ?? 'hard']}</dd>
	</div>
	<div>
		<dt>Access</dt>
		<dd>
			{#if court.access === 'reservation'}
				Paid, reservation required
				{#if court.bookingUrl}
					<br /><ExternalLink href={court.bookingUrl}>Book court time</ExternalLink>
				{/if}
			{:else if court.access === 'fee'}
				Fee to play
				{#if court.bookingUrl}
					<br /><ExternalLink href={court.bookingUrl}>Court fees and booking</ExternalLink>
				{/if}
			{:else}
				Free, first come first served
			{/if}
		</dd>
	</div>
</dl>

<style>
	.card {
		padding: var(--space-2) var(--space-4);
		border-radius: var(--radius-card);
		background: var(--card);
	}

	.facts {
		margin: 0;
	}

	.facts div {
		display: flex;
		justify-content: space-between;
		gap: var(--space-4);
		padding: var(--space-3) 0;
	}

	.facts div + div {
		border-top: 0.5px solid var(--separator);
	}

	dd {
		margin: 0;
		color: var(--label-2);
		text-align: right;
	}
</style>
