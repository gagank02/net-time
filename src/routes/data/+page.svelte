<script lang="ts">
	import ExternalLink from '#lib/components/ExternalLink.svelte';
	import { chicagoDataDisclaimer, chicagoTermsUrl, reportDataProblemUrl } from '#lib/legal.js';
	import { facilitySources } from '#lib/sources.js';

	const cityDatasets = [
		{
			id: 'eix4-gf83',
			name: 'CPD Facilities',
			owner: 'Chicago Park District',
			license: 'Public Domain',
			use: 'finding which tennis courts belong to the Park District'
		},
		{
			id: 'tn7v-6rnw',
			name: 'Chicago Park District Activities',
			owner: 'Chicago Park District',
			license: 'City of Chicago Data Terms of Use',
			use: 'class and program schedules, with sign-up links to the Park District registration site'
		},
		{
			id: 'igwz-8jzy',
			name: 'Boundaries - Community Areas',
			owner: 'City of Chicago',
			license: 'City of Chicago Data Terms of Use',
			use: 'neighborhood search and labels'
		},
		{
			id: 'unjd-c2ca',
			name: 'Boundaries - ZIP Codes',
			owner: 'City of Chicago, Department of Technology and Innovation',
			license: 'City of Chicago Data Terms of Use',
			use: 'ZIP code search'
		}
	];
</script>

<svelte:head>
	<title>Data sources and disclaimer · net-time</title>
	<meta name="description" content="Where net-time's court data comes from, and its limits." />
</svelte:head>

<h1>Data sources</h1>
<p class="lede">
	We build court information from public sources, and it can be out of date. Check the signs at the
	park before you go.
</p>

<section aria-labelledby="disclaimer">
	<h2 id="disclaimer">City of Chicago data disclaimer</h2>
	<blockquote class="card" data-testid="chicago-disclaimer">{chicagoDataDisclaimer}</blockquote>
	<p class="note">
		Use of City of Chicago data is subject to the
		<ExternalLink href={chicagoTermsUrl}>City of Chicago Data Terms of Use</ExternalLink>.
	</p>
</section>

<section aria-labelledby="sources">
	<h2 id="sources">Sources</h2>
	<ul class="card list" role="list">
		{#each cityDatasets as d (d.id)}
			<li>
				<span class="title">
					<ExternalLink href="https://data.cityofchicago.org/d/{d.id}">{d.name}</ExternalLink>
				</span>
				<span class="meta">{d.owner} · {d.license}</span>
				<span class="meta">Used for {d.use}</span>
			</li>
		{/each}
		<li>
			<span class="title">
				<ExternalLink href="https://www.openstreetmap.org/copyright">OpenStreetMap</ExternalLink>
			</span>
			<span class="meta">© OpenStreetMap contributors · Open Database License (ODbL)</span>
			<span class="meta">Used for court locations, lights and surface</span>
		</li>
		{#each facilitySources as f (f.host)}
			<li>
				<span class="title">
					<ExternalLink href="https://{f.host}">{f.name}</ExternalLink>
				</span>
				<span class="meta">{f.owner}</span>
				<span class="meta">Used for {f.use}, entered by hand with a link to the page</span>
			</li>
		{/each}
	</ul>
</section>

<p class="note">
	From facility websites we take only facts, such as hours, seasons and fees, and write them in our
	own words with a link to the page. We copy no text, photos or logos.
</p>

<section aria-labelledby="problems">
	<h2 id="problems">Found a mistake?</h2>
	<p>
		<ExternalLink href={reportDataProblemUrl}>Report a data problem</ExternalLink>. We fix our copy
		and, where the error is in a City dataset, pass it on to the City.
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

	blockquote {
		font-size: var(--text-subhead);
		line-height: 1.5;
	}

	.note {
		margin-top: var(--space-3);
		color: var(--label-2);
		font-size: var(--text-footnote);
	}

	.list {
		display: grid;
		gap: var(--space-4);
	}

	.list li {
		display: grid;
		gap: 2px;
	}

	.meta {
		color: var(--label-2);
		font-size: var(--text-subhead);
	}
</style>
