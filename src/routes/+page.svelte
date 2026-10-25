<script lang="ts">
	import { resolve } from '$app/paths';
</script>

<svelte:head>
	<title>net-time · Tennis in Chicago</title>
	<meta
		name="description"
		content="Find public tennis courts, class schedules, pro shops and hitting partners across Chicago."
	/>
</svelte:head>

<section class="hero">
	<p class="eyebrow">Chicago</p>
	<h1>Find a court.<br />Find a hit.</h1>
	<p class="lede">
		Public courts and their hours, classes that take them over, stringing and pro shops, and players
		at your level, all in one place.
	</p>
</section>

<section aria-labelledby="explore">
	<h2 id="explore" class="section-title">Explore</h2>
	<ul class="grouped" role="list">
		<li>
			<a class="row-link" href={resolve('/courts')}>
				<span class="dot courts" aria-hidden="true"></span>
				<span class="text">
					<span class="title">Courts near you</span>
					<span class="subtitle">Open hours and when classes are on</span>
				</span>
				<svg class="chevron" viewBox="0 0 8 14" aria-hidden="true"
					><path d="M1 1l6 6-6 6" fill="none" stroke-width="2" /></svg
				>
			</a>
		</li>
	</ul>
</section>

<section aria-labelledby="soon">
	<h2 id="soon" class="section-title">Coming soon</h2>
	<ul class="grouped" role="list">
		<li>
			<span class="dot shops" aria-hidden="true"></span>
			<span class="text">
				<span class="title">Stringing and pro shops</span>
				<span class="subtitle">Services, hours and turnaround</span>
			</span>
		</li>
		<li>
			<span class="dot players" aria-hidden="true"></span>
			<span class="text">
				<span class="title">Players at your level</span>
				<span class="subtitle">Find someone to hit with</span>
			</span>
		</li>
	</ul>
</section>

<style>
	.hero {
		padding: var(--space-6) 0 var(--space-8);
	}

	.eyebrow {
		color: var(--tint);
		font-size: var(--text-subhead);
		font-weight: 600;
	}

	h1 {
		margin-top: var(--space-1);
		font-size: clamp(var(--text-large-title), 8vw, 3.5rem);
		font-weight: 700;
		letter-spacing: -0.025em;
	}

	.lede {
		max-width: 34rem;
		margin-top: var(--space-4);
		color: var(--label-2);
		font-size: var(--text-title-3);
		line-height: 1.4;
	}

	.section-title {
		padding: 0 var(--space-4) var(--space-2);
		color: var(--label-2);
		font-size: var(--text-footnote);
		font-weight: 400;
		text-transform: uppercase;
		letter-spacing: 0.02em;
	}

	/* iOS inset grouped list */
	.grouped {
		overflow: hidden;
		border-radius: var(--radius-card);
		background: var(--card);
	}

	.grouped li {
		position: relative;
		display: flex;
		align-items: center;
		gap: var(--space-3);
		min-height: var(--target);
		padding: var(--space-3) var(--space-4);
	}

	/* Hairline separator inset to the text, like iOS */
	.grouped li + li::before {
		content: '';
		position: absolute;
		top: 0;
		right: 0;
		left: calc(var(--space-4) + 1.75rem + var(--space-3));
		border-top: 0.5px solid var(--separator);
	}

	section + section {
		margin-top: var(--space-6);
	}

	/* A whole row as one link, iOS style */
	.grouped li:has(.row-link) {
		padding: 0;
	}

	.row-link {
		display: flex;
		flex: 1;
		align-items: center;
		gap: var(--space-3);
		min-height: var(--target);
		padding: var(--space-3) var(--space-4);
		color: inherit;
	}

	.row-link:hover {
		text-decoration: none;
		background: var(--fill);
	}

	.chevron {
		width: 0.5rem;
		height: 0.875rem;
		margin-left: auto;
		stroke: var(--label-2);
		opacity: 0.6;
	}

	.dot {
		flex: none;
		width: 1.75rem;
		height: 1.75rem;
		border-radius: 0.4375rem;
	}

	.courts {
		background: var(--tint);
	}

	.shops {
		background: var(--link);
	}

	.players {
		background: var(--indigo);
	}

	.text {
		display: grid;
		gap: 2px;
	}

	.title {
		font-size: var(--text-body);
	}

	.subtitle {
		color: var(--label-2);
		font-size: var(--text-subhead);
	}
</style>
