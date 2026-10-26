<script lang="ts">
	import { resolve } from '$app/paths';
	import type { CourtListItem, CourtStatus } from '#lib/courts/types.js';
	import StatusBadge from './StatusBadge.svelte';

	let {
		court,
		status,
		distance
	}: { court: CourtListItem; status: CourtStatus | null; distance?: string } = $props();

	const facts = $derived(
		[
			`${court.courtCount} ${court.courtCount === 1 ? 'court' : 'courts'}`,
			court.indoor ? 'indoor' : null,
			court.lights ? 'lights' : null,
			court.communityArea,
			distance ?? null
		].filter(Boolean)
	);
</script>

<a class="row" href={resolve('/courts/[slug]', { slug: court.slug })}>
	<span class="name">{court.name}</span>
	<StatusBadge {status} courtCount={court.courtCount} access={court.access} />
	<span class="facts">{facts.join(' · ')}</span>
	<svg class="chevron" viewBox="0 0 8 14" aria-hidden="true"
		><path d="M1 1l6 6-6 6" fill="none" stroke-width="2" /></svg
	>
</a>

<style>
	.row {
		position: relative;
		display: grid;
		gap: 2px;
		padding: var(--space-3) calc(var(--space-4) + 1rem) var(--space-3) var(--space-4);
		color: inherit;
		text-decoration: none;
	}

	.row:hover {
		text-decoration: none;
		background: var(--fill);
	}

	.name {
		font-size: var(--text-body);
		font-weight: 500;
	}

	.facts {
		color: var(--label-2);
		font-size: var(--text-footnote);
	}

	.chevron {
		position: absolute;
		top: 50%;
		right: var(--space-4);
		width: 0.5rem;
		height: 0.875rem;
		transform: translateY(-50%);
		stroke: var(--label-2);
		opacity: 0.6;
	}
</style>
