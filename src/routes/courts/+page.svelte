<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import CourtMap from '#lib/components/courts/CourtMap.svelte';
	import CourtRow from '#lib/components/courts/CourtRow.svelte';
	import LocationControls from '#lib/components/courts/LocationControls.svelte';
	import { liveNow } from '#lib/courts/clock.svelte.js';
	import { courtStatus, formatClock } from '#lib/courts/status.js';
	import { distanceMeters, formatDistance, type LatLng } from '#lib/geo.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const clock = liveNow(() => data.now);
	let showMap = $state(false);
	const now = $derived(clock.current);

	const openOnly = $derived(page.url.searchParams.get('open') === '1');
	const lightsOnly = $derived(page.url.searchParams.get('lights') === '1');
	const areaParam = $derived(page.url.searchParams.get('area') ?? '');
	const zipParam = $derived(page.url.searchParams.get('zip')?.trim() ?? '');

	// Device position lives only in this component's memory: never in the URL, storage, or a request.
	let device = $state<LatLng | null>(null);
	let locating = $state(false);
	let locError = $state('');

	function locate() {
		if (!('geolocation' in navigator)) {
			locError = "This browser can't share your location. Pick a neighborhood or enter a ZIP.";
			return;
		}
		locating = true;
		locError = '';
		navigator.geolocation.getCurrentPosition(
			(pos) => {
				device = { lat: pos.coords.latitude, lng: pos.coords.longitude };
				locating = false;
			},
			(err) => {
				locating = false;
				locError =
					err.code === err.PERMISSION_DENIED
						? 'Location is blocked for this site. Pick a neighborhood or enter a ZIP instead.'
						: "Couldn't get your location. Pick a neighborhood or enter a ZIP instead.";
			},
			{ enableHighAccuracy: false, maximumAge: 5 * 60_000, timeout: 10_000 }
		);
	}

	const area = $derived(data.areas.find((a) => a.slug === areaParam));
	const zip = $derived(data.zips.find((z) => z.zip === zipParam));
	const origin = $derived.by((): (LatLng & { label: string }) | null => {
		if (device) return { ...device, label: 'your location' };
		if (area) return { ...area, label: area.name };
		if (zip) return { ...zip, label: zip.zip };
		return null;
	});
	const zipError = $derived(
		zipParam && !zip && !device && !area
			? `${zipParam} isn't a Chicago ZIP we know. Try a neighborhood.`
			: ''
	);

	function clearLocation() {
		device = null;
		const url = new URL(page.url.href);
		url.searchParams.delete('area');
		url.searchParams.delete('zip');
		goto(url.pathname + url.search, { reset: false });
	}

	const rows = $derived(
		data.courts
			.map((court) => ({
				court,
				status: courtStatus(court.courtCount, court.hours, court.classes, now),
				meters: origin ? distanceMeters(origin, court) : null
			}))
			.filter(
				({ court, status }) =>
					(!openOnly || status.state !== 'closed') && (!lightsOnly || court.lights)
			)
			.sort((a, b) => (a.meters ?? 0) - (b.meters ?? 0))
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
	<LocationControls
		areas={data.areas}
		area={areaParam}
		zip={zipParam}
		usingDevice={device !== null}
		{locating}
		error={locError || zipError}
		onlocate={locate}
		onchoose={() => (device = null)}
	/>
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
	{#if origin}
		Nearest to {origin.label} ·
		<button type="button" class="link" onclick={clearLocation}>Clear location</button> ·
	{/if}
	{#if rows.length === data.courts.length}
		Showing all {rows.length}
	{:else}
		Showing {rows.length} of {data.courts.length}
		· <a href={resolve('/courts')} data-sveltekit-noscroll>Clear filters</a>
	{/if}
</p>

<button
	type="button"
	class="map-toggle"
	aria-expanded={showMap}
	aria-controls="courts-map"
	onclick={() => (showMap = !showMap)}
>
	{showMap ? 'Hide map' : 'Show map'}
</button>
<div id="courts-map">
	{#if showMap}
		<CourtMap {rows} />
	{/if}
</div>

{#if rows.length}
	<ul class="grouped" role="list" aria-label="Courts">
		{#each rows as { court, status, meters } (court.slug)}
			<li>
				<CourtRow
					{court}
					{status}
					distance={meters === null ? undefined : formatDistance(meters)}
				/>
			</li>
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
		display: grid;
		gap: var(--space-4);
		margin-top: var(--space-5);
	}

	.link {
		padding: 0;
		border: 0;
		background: none;
		color: var(--link);
		font: inherit;
		text-decoration: underline;
		cursor: pointer;
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

	.map-toggle {
		min-height: var(--target);
		margin: 0 0 var(--space-3);
		padding: 0 var(--space-4);
		border: 0;
		border-radius: var(--radius-control);
		background: var(--card);
		color: var(--link);
		font-size: var(--text-subhead);
		font-weight: 600;
		cursor: pointer;
	}

	#courts-map:not(:empty) {
		margin-bottom: var(--space-4);
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
