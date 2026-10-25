<script lang="ts">
	import type { Snippet } from 'svelte';
	import { resolve } from '$app/paths';
	import type { Theme } from '#lib/theme.js';
	import ExternalLink from './ExternalLink.svelte';
	import SkipLink from './SkipLink.svelte';
	import ThemeToggle from './ThemeToggle.svelte';

	let { theme, children }: { theme: Theme; children: Snippet } = $props();
</script>

<SkipLink />

<header>
	<nav aria-label="Main">
		<a class="brand" href={resolve('/')}>
			<span class="ball" aria-hidden="true"></span>
			net-time
		</a>
	</nav>
</header>

<main id="main" tabindex="-1">
	{@render children()}
</main>

<footer>
	<ThemeToggle {theme} />
	<p class="attribution">
		Court and shop data ©
		<ExternalLink href="https://www.openstreetmap.org/copyright">OpenStreetMap</ExternalLink>
		contributors (ODbL) and the
		<ExternalLink href="https://data.cityofchicago.org">City of Chicago Data Portal</ExternalLink>,
		modified for use here. Provided as is; it may be incomplete or out of date.
		<a href={resolve('/data')}>Data sources and disclaimer</a>
	</p>
</footer>

<style>
	/* Frosted translucent nav bar */
	header {
		position: sticky;
		top: 0;
		z-index: 10;
		background: var(--bar);
		backdrop-filter: saturate(180%) blur(20px);
		-webkit-backdrop-filter: saturate(180%) blur(20px);
		border-bottom: 0.5px solid var(--separator);
		padding-top: env(safe-area-inset-top);
	}

	nav {
		display: flex;
		align-items: center;
		max-width: var(--content-width);
		min-height: var(--target);
		margin: 0 auto;
		padding: 0 var(--gutter);
	}

	.brand {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		min-height: var(--target);
		color: var(--label);
		font-size: var(--text-body);
		font-weight: 700;
		letter-spacing: -0.02em;
	}

	.brand:hover {
		text-decoration: none;
	}

	.ball {
		width: 0.875rem;
		height: 0.875rem;
		border-radius: 50%;
		background: var(--tint);
	}

	main {
		max-width: var(--content-width);
		margin: 0 auto;
		padding: var(--space-6) var(--gutter) var(--space-12);
		outline: none;
	}

	footer {
		display: grid;
		gap: var(--space-4);
		max-width: var(--content-width);
		margin: 0 auto;
		padding: var(--space-6) var(--gutter) calc(var(--space-8) + env(safe-area-inset-bottom));
		border-top: 0.5px solid var(--separator);
	}

	.attribution {
		color: var(--label-2);
		font-size: var(--text-caption);
		line-height: 1.5;
	}
</style>
