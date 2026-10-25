<script lang="ts">
	import { resolve } from '$app/paths';
	import ExternalLink from '#lib/components/ExternalLink.svelte';
	import ClassSchedule from '#lib/components/courts/ClassSchedule.svelte';
	import HoursTable from '#lib/components/courts/HoursTable.svelte';
	import StatusBadge from '#lib/components/courts/StatusBadge.svelte';
	import { liveNow } from '#lib/courts/clock.svelte.js';
	import { courtStatus, formatDate } from '#lib/courts/status.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const court = $derived(data.court);
	const clock = liveNow(() => data.now);
	const status = $derived(courtStatus(court.courtCount, court.hours, court.classes, clock.current));

	const yesNo = (v: boolean | null) => (v === null ? 'Not known' : v ? 'Yes' : 'No');
	const surfaces = { hard: 'Hard court', clay: 'Clay', grass: 'Grass', other: 'Other' } as const;

	// Directions go to the court's coordinates (never the user's) in the user's map app of choice.
	const destination = $derived(`${court.lat},${court.lng}`);
	const appleMaps = $derived(
		`https://maps.apple.com/?daddr=${destination}&q=${encodeURIComponent(court.name)}`
	);
	const googleMaps = $derived(
		`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`
	);
</script>

<svelte:head>
	<title>{court.name} tennis courts · net-time</title>
	<meta
		name="description"
		content="{court.name} has {court.courtCount} tennis {court.courtCount === 1
			? 'court'
			: 'courts'} in {court.communityArea}, Chicago. See hours, lights and classes."
	/>
</svelte:head>

<a class="back" href={resolve('/courts')}>‹ All courts</a>

<header class="title">
	<h1>{court.name}</h1>
	<p class="area">{court.communityArea} · Chicago Park District</p>
	<StatusBadge {status} courtCount={court.courtCount} access={court.access} />
</header>

<section aria-labelledby="facts-h">
	<h2 id="facts-h" class="section-title">About the courts</h2>
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
			<dd>{court.surface ? surfaces[court.surface] : 'Not known'}</dd>
		</div>
		<div>
			<dt>Access</dt>
			<dd>
				{#if court.access === 'reservation'}
					Paid, reservation required
					{#if court.bookingUrl}
						<br /><ExternalLink href={court.bookingUrl}>Book court time</ExternalLink>
					{/if}
				{:else}
					Free, first come first served
				{/if}
			</dd>
		</div>
	</dl>
</section>

<section aria-labelledby="hours-h">
	<h2 id="hours-h" class="section-title">Hours</h2>
	<div class="card">
		<HoursTable hours={court.hours} now={clock.current} />
	</div>
	<p class="footnote">
		{#if court.hoursSourceUrl}
			<ExternalLink href={court.hoursSourceUrl}>Hours source</ExternalLink>
		{:else}
			Standard Chicago Park District hours, 6 AM – 11 PM, unless the park posts other hours.
		{/if}
	</p>
</section>

{#if court.classes.length}
	<section aria-labelledby="classes-h">
		<h2 id="classes-h" class="section-title">Classes and programs using the courts</h2>
		<div class="card">
			<ClassSchedule classes={court.classes} courtCount={court.courtCount} />
		</div>
	</section>
{/if}

<section aria-labelledby="go-h">
	<h2 id="go-h" class="section-title">Getting there</h2>
	<div class="card directions">
		{#if court.address}<p>{court.address}</p>{/if}
		<p class="links">
			<ExternalLink href={appleMaps}>Directions in Apple Maps</ExternalLink>
			<ExternalLink href={googleMaps}>Directions in Google Maps</ExternalLink>
		</p>
	</div>
</section>

<p class="footnote provenance">
	Last checked {formatDate(court.verifiedAt)}. Court locations from
	{#if court.osmIds.length}
		<ExternalLink href="https://www.openstreetmap.org/{court.osmIds[0]}">OpenStreetMap</ExternalLink
		>
	{:else}
		Chicago Park District records
	{/if}
	· <a href={resolve('/data')}>Data sources and disclaimer</a>
</p>

<style>
	.back {
		display: inline-flex;
		align-items: center;
		min-height: var(--target);
		font-size: var(--text-body);
	}

	.title {
		display: grid;
		gap: var(--space-1);
		margin-bottom: var(--space-6);
	}

	h1 {
		font-size: var(--text-large-title);
		font-weight: 700;
	}

	.area {
		color: var(--label-2);
	}

	section {
		margin-top: var(--space-6);
	}

	.section-title {
		padding: 0 var(--space-4) var(--space-2);
		color: var(--label-2);
		font-size: var(--text-footnote);
		font-weight: 400;
		text-transform: uppercase;
		letter-spacing: 0.02em;
	}

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

	.directions {
		display: grid;
		gap: var(--space-2);
		padding: var(--space-4);
	}

	.links {
		display: grid;
		gap: var(--space-2);
	}

	.footnote {
		margin-top: var(--space-2);
		padding: 0 var(--space-4);
		color: var(--label-2);
		font-size: var(--text-footnote);
	}

	.provenance {
		margin-top: var(--space-8);
	}
</style>
