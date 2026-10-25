<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import CourtRow from '#lib/components/courts/CourtRow.svelte';
	import { courtStatus, formatClock } from '#lib/courts/status.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// Server time first (so SSR and hydration agree), then the browser keeps statuses fresh.
	let now = $derived(new Date(data.now));
	$effect(() => {
		now = new Date();
		const timer = setInterval(() => (now = new Date()), 60_000);
		return () => clearInterval(timer);
	});

	const openOnly = $derived(page.url.searchParams.get('open') === '1');
	const lightsOnly = $derived(page.url.searchParams.get('lights') === '1');

	const rows = $derived(
		data.courts
			.map((court) => ({
				court,
				status: courtStatus(court.courtCount, court.hours, court.classes, now)
			}))
			.filter(
				({ court, status }) =>
					(!openOnly || status.state !== 'closed') && (!lightsOnly || court.lights)
			)
	);

	const asOf = $derived(
		formatClock(
			new Intl.DateTimeFormat('en-GB', {
				timeZone: 'America/Chicago',
				hour: '2-digit',
				minute: '2-digit',
				hourCycle: 'h23'
			}).format(now)
		)
	);
</script>

<svelte:head>
	<title>Tennis courts in Chicago · net-time</title>
	<meta
		name="description"
		content="Every Chicago Park District tennis court, with hours and when classes take them over."
	/>
</svelte:head>

<h1>Courts</h1>
<p class="lede">
	{data.courts.length} Chicago Park District locations. Status as of {asOf}, from posted hours and
	classes. Courts may still be busy.
</p>

<form method="GET" class="filters" data-sveltekit-keepfocus data-sveltekit-noscroll>
	<fieldset>
		<legend class="visually-hidden">Filter courts</legend>
		<label class="chip">
			<input
				type="checkbox"
				name="open"
				value="1"
				checked={openOnly}
				onchange={(e) => e.currentTarget.form?.requestSubmit()}
			/>
			<span>Open now</span>
		</label>
		<label class="chip">
			<input
				type="checkbox"
				name="lights"
				value="1"
				checked={lightsOnly}
				onchange={(e) => e.currentTarget.form?.requestSubmit()}
			/>
			<span>Lights</span>
		</label>
		<noscript><button type="submit">Apply</button></noscript>
	</fieldset>
</form>

<p class="count" aria-live="polite">
	{#if rows.length === data.courts.length}
		Showing all {rows.length}
	{:else}
		Showing {rows.length} of {data.courts.length}
		· <a href={resolve('/courts')} data-sveltekit-noscroll>Clear filters</a>
	{/if}
</p>

{#if rows.length}
	<ul class="grouped" role="list">
		{#each rows as { court, status } (court.slug)}
			<li><CourtRow {court} {status} /></li>
		{/each}
	</ul>
{:else}
	<p class="empty">No courts match. Try removing a filter.</p>
{/if}

<style>
	h1 {
		font-size: var(--text-large-title);
		font-weight: 700;
	}

	.lede {
		margin-top: var(--space-1);
		color: var(--label-2);
		font-size: var(--text-subhead);
	}

	.filters {
		margin-top: var(--space-5);
	}

	fieldset {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		margin: 0;
		padding: 0;
		border: 0;
	}

	/* Toggle chips: real checkboxes, styled like iOS filter pills */
	.chip {
		position: relative;
		display: inline-flex;
		align-items: center;
		min-height: var(--target);
		padding: 0 var(--space-4);
		border-radius: 999px;
		background: var(--fill);
		font-size: var(--text-subhead);
		font-weight: 500;
		cursor: pointer;
	}

	.chip input {
		position: absolute;
		inset: 0;
		margin: 0;
		opacity: 0;
		cursor: pointer;
	}

	.chip:has(input:checked) {
		background: var(--tint);
		color: var(--on-tint);
	}

	.chip:has(input:focus-visible) {
		outline: 3px solid var(--focus);
		outline-offset: 2px;
	}

	.count {
		margin: var(--space-4) var(--space-4) var(--space-2);
		color: var(--label-2);
		font-size: var(--text-footnote);
	}

	.grouped {
		overflow: hidden;
		border-radius: var(--radius-card);
		background: var(--card);
	}

	.grouped li + li {
		border-top: 0.5px solid var(--separator);
	}

	.empty {
		padding: var(--space-6) var(--space-4);
		border-radius: var(--radius-card);
		background: var(--card);
		color: var(--label-2);
		text-align: center;
	}
</style>
