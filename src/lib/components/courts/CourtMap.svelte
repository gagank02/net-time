<script lang="ts">
	import { resolve } from '$app/paths';
	import { describeStatus } from '#lib/courts/status.js';
	import type { CourtListItem, CourtStatus } from '#lib/courts/types.js';
	import type { Map as MapLibreMap, Marker } from 'maplibre-gl';

	let { rows }: { rows: { court: CourtListItem; status: CourtStatus }[] } = $props();

	const styles = {
		light: 'https://tiles.openfreemap.org/styles/positron',
		dark: 'https://tiles.openfreemap.org/styles/dark'
	};
	// Chicago city limits; also the view when no court matches the filters.
	const chicago: [[number, number], [number, number]] = [
		[-87.94, 41.64],
		[-87.52, 42.03]
	];

	let container: HTMLDivElement | undefined = $state();
	let map: MapLibreMap | undefined = $state();
	let maplibre: typeof import('maplibre-gl') | undefined;
	let failed = $state(false);

	const isDark = () =>
		document.documentElement.dataset.theme === 'dark' ||
		(document.documentElement.dataset.theme !== 'light' &&
			matchMedia('(prefers-color-scheme: dark)').matches);

	// Attribution comes from the tile server with target=_blank but no rel; match our link rule.
	const patchLinks = () =>
		container
			?.querySelectorAll<HTMLAnchorElement>('a[target="_blank"]')
			.forEach((a) => (a.rel = 'noopener noreferrer'));

	// Create the map once. maplibre-gl (and its CSS) load only now, never with the list page.
	$effect(() => {
		let cancelled = false;
		let observer: MutationObserver | undefined;
		const media = matchMedia('(prefers-color-scheme: dark)');
		const restyle = () => map?.setStyle(isDark() ? styles.dark : styles.light);

		(async () => {
			const [lib, worker] = await Promise.all([
				import('maplibre-gl'),
				// maplibre-gl 6 decodes tiles in a separate worker file; ship it as a same-origin asset.
				import('maplibre-gl/dist/maplibre-gl-worker.mjs?url'),
				import('maplibre-gl/dist/maplibre-gl.css')
			]);
			lib.setWorkerUrl(worker.default);
			if (cancelled || !container) return;
			maplibre = lib;
			try {
				map = new lib.Map({
					container,
					style: isDark() ? styles.dark : styles.light,
					bounds: chicago,
					fitBoundsOptions: { padding: 24 },
					// One finger scrolls the page; two fingers (or Ctrl/⌘ + scroll) move the map.
					cooperativeGestures: true,
					attributionControl: { compact: false }
				});
			} catch {
				failed = true; // e.g. WebGL unavailable
				return;
			}
			map.addControl(new lib.NavigationControl({ showCompass: false }), 'top-right');
			map.on('sourcedata', patchLinks);
			map.on('idle', patchLinks);
			observer = new MutationObserver(restyle);
			observer.observe(document.documentElement, { attributeFilter: ['data-theme'] });
			media.addEventListener('change', restyle);
		})();

		return () => {
			cancelled = true;
			observer?.disconnect();
			media.removeEventListener('change', restyle);
			map?.remove();
		};
	});

	// One focusable pin per court, redrawn when filters or statuses change.
	$effect(() => {
		if (!map || !maplibre) return;
		const lib = maplibre;
		const markers: Marker[] = rows.map(({ court, status }) => {
			const { label, detail } = describeStatus(status, court.courtCount, court.seasonNote);
			// Pins are a visual aid for pointer/touch users: the list below is the accessible
			// equivalent (same courts, statuses and links), so pins stay out of the tab order.
			const el = document.createElement('div');
			el.className = `pin ${status.state}`;
			el.dataset.slug = court.slug;
			el.title = `${court.name}: ${label}`;
			el.setAttribute('aria-hidden', 'true');

			const popup = new lib.Popup({ offset: 14, closeButton: true, maxWidth: '16rem' });
			const body = document.createElement('div');
			const link = document.createElement('a');
			link.href = resolve('/courts/[slug]', { slug: court.slug });
			link.textContent = court.name; // text, never HTML
			const line = document.createElement('p');
			line.textContent = `${label} · ${detail}`;
			// appendChild, not append: Workers types shadow the DOM Element.append signature here.
			body.appendChild(link);
			body.appendChild(line);
			popup.setDOMContent(body);

			const marker = new lib.Marker({ element: el })
				.setLngLat([court.lng, court.lat])
				.setPopup(popup)
				.addTo(map!);
			el.tabIndex = -1; // maplibre makes markers tabbable; these are visual-only (aria-hidden)
			return marker;
		});
		if (rows.length) {
			const bounds = new lib.LngLatBounds();
			for (const { court } of rows) bounds.extend([court.lng, court.lat]);
			map.fitBounds(bounds, { padding: 40, maxZoom: 14, duration: 0 });
		}
		return () => markers.forEach((m) => m.remove());
	});
</script>

<div class="map-wrap">
	{#if failed}
		<p class="fallback" role="status">
			This device can't show the map. The list below has every court.
		</p>
	{:else}
		<div
			class="map"
			bind:this={container}
			role="region"
			aria-label="Map of courts. The list below has the same courts and statuses."
		></div>
	{/if}
</div>

<style>
	.map-wrap {
		overflow: hidden;
		border-radius: var(--radius-card);
		background: var(--card);
	}

	.map {
		height: min(60vh, 30rem);
	}

	.fallback {
		padding: var(--space-6) var(--space-4);
		color: var(--label-2);
		text-align: center;
	}

	/* Pins are created by maplibre outside Svelte's tree, hence :global. Shape mirrors StatusBadge. */
	.map :global(.pin) {
		width: 0.875rem;
		height: 0.875rem;
		border: 1.5px solid var(--card);
		border-radius: 50%;
		box-shadow: 0 1px 4px rgb(0 0 0 / 0.35);
		cursor: pointer;
	}

	.map :global(.pin.open) {
		background: var(--tint);
	}

	.map :global(.pin.class) {
		background: linear-gradient(90deg, var(--amber) 50%, var(--card) 50%);
		box-shadow:
			inset 0 0 0 1.5px var(--amber),
			0 1px 4px rgb(0 0 0 / 0.35);
	}

	.map :global(.pin.closed) {
		background: var(--card);
		box-shadow:
			inset 0 0 0 2.5px var(--label-2),
			0 1px 4px rgb(0 0 0 / 0.35);
	}

	.map :global(.maplibregl-popup-content) {
		padding: var(--space-3) var(--space-4);
		border-radius: var(--radius-control);
		background: var(--card);
		color: var(--label);
		font: var(--text-subhead) / 1.35 var(--font);
	}

	.map :global(.maplibregl-popup-content a) {
		font-weight: 600;
	}
</style>
