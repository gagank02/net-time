<script lang="ts">
	import ExternalLink from '#lib/components/ExternalLink.svelte';
	import { reportDataProblemUrl } from '#lib/legal.js';
</script>

<svelte:head>
	<title>Privacy · net-time</title>
	<meta name="description" content="What net-time collects about you. In short, nothing." />
</svelte:head>

<h1>Privacy</h1>
<p class="lede">
	You don't need an account, and we don't collect anything about you. No cookies, no ads, no
	tracking, no fingerprinting, and nothing records what you type or tap.
</p>

<section aria-labelledby="location">
	<h2 id="location">Your location</h2>
	<p>
		When you tap Use my location, your browser gives the position to this page. The page sorts the
		courts on your device. Your location never leaves it. We don't send it, store it or log it.
	</p>
	<p>
		A neighborhood or ZIP you pick goes in the page address so you can share the link. It never
		holds your exact position.
	</p>
</section>

<section aria-labelledby="device">
	<h2 id="device">What stays in your browser</h2>
	<p>
		If you pick Light or Dark, your browser remembers that choice on your device. Pick System and it
		forgets it.
	</p>
</section>

<section aria-labelledby="others">
	<h2 id="others">Other services</h2>
	<ul class="card list" role="list">
		<li>
			<span class="title">Cloudflare hosts this site</span>
			<span class="meta"
				>Like any web host, it sees your IP address to deliver pages and block attacks. We don't
				keep it.</span
			>
			<span class="meta"
				><ExternalLink href="https://www.cloudflare.com/privacypolicy/"
					>Cloudflare privacy policy</ExternalLink
				></span
			>
		</li>
		<li>
			<span class="title">OpenFreeMap draws the map</span>
			<span class="meta"
				>Only after you tap Show map does your browser fetch map images from OpenFreeMap. It sees
				your IP address, uses no cookies, and deletes its logs after 7 days.</span
			>
			<span class="meta"
				><ExternalLink href="https://openfreemap.org/privacy/"
					>OpenFreeMap privacy policy</ExternalLink
				></span
			>
		</li>
		<li>
			<span class="title">Apple Maps and Google Maps</span>
			<span class="meta"
				>Directions links open their sites only when you tap them. Their own privacy policies apply
				there.</span
			>
		</li>
	</ul>
</section>

<section aria-labelledby="children">
	<h2 id="children">Children</h2>
	<p>
		This site is for adult players. It has no accounts and collects no personal information from
		anyone, including children under 13.
	</p>
</section>

<section aria-labelledby="questions">
	<h2 id="questions">Questions</h2>
	<p>
		<ExternalLink href={reportDataProblemUrl}>Open an issue on GitHub</ExternalLink>. If this page
		changes, the new version goes up here before we collect anything new.
	</p>
</section>

<style>
	h1 {
		font-size: var(--text-large-title);
		font-weight: 700;
	}

	.lede {
		margin-top: var(--space-2);
		color: var(--label-2);
	}

	section {
		margin-top: var(--space-8);
	}

	section p + p {
		margin-top: var(--space-3);
	}

	h2 {
		margin-bottom: var(--space-3);
		font-size: var(--text-title-3);
		font-weight: 600;
	}

	.card {
		margin: 0;
		padding: var(--space-4);
		border-radius: var(--radius-card);
		background: var(--card);
	}

	.list {
		display: grid;
		gap: var(--space-4);
	}

	.list li {
		display: grid;
		gap: 2px;
	}

	.title {
		font-weight: 600;
	}

	.meta {
		color: var(--label-2);
		font-size: var(--text-subhead);
	}
</style>
