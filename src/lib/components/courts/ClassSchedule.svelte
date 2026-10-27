<script lang="ts">
	import ExternalLink from '#lib/components/ExternalLink.svelte';
	import { dayRanges, formatClock, formatDate } from '#lib/courts/status.js';
	import type { ClassDetail } from '#lib/courts/types.js';

	let { classes, courtCount }: { classes: ClassDetail[]; courtCount: number } = $props();

	const shortDate = (date: string) => formatDate(date).replace(/, \d{4}$/, '');
	const fee = (n: number) => (n === 0 ? 'Free' : `$${n}`);
</script>

<ul class="blocks" role="list">
	{#each classes as c, i (i)}
		<li>
			<p class="when">{dayRanges(c.weekdays)} · {formatClock(c.starts)} – {formatClock(c.ends)}</p>
			<p class="what">{c.title}</p>
			<p class="meta">
				{[
					c.ages,
					c.fee === null ? null : fee(c.fee),
					`${formatDate(c.seasonStart)} – ${formatDate(c.seasonEnd)}`,
					c.courtsUsed === null
						? null
						: `uses ${Math.min(c.courtsUsed, courtCount)} of ${courtCount} ${courtCount === 1 ? 'court' : 'courts'}`
				]
					.filter(Boolean)
					.join(' · ')}
			</p>
			{#if c.except.length}
				<p class="meta">No class {c.except.map(shortDate).join(', ')}</p>
			{/if}
			<p class="meta">
				{#if c.signupUrl}
					<ExternalLink href={c.signupUrl}>Details and sign-up</ExternalLink> ·
				{/if}
				<ExternalLink href={c.sourceUrl}>Source</ExternalLink> · checked {formatDate(c.verifiedAt)}
			</p>
		</li>
	{/each}
</ul>

<style>
	.blocks {
		display: grid;
	}

	li {
		display: grid;
		gap: 2px;
		padding: var(--space-3) 0;
	}

	li + li {
		border-top: 0.5px solid var(--separator);
	}

	.when {
		font-weight: 600;
		font-size: var(--text-subhead);
	}

	.meta {
		color: var(--label-2);
		font-size: var(--text-footnote);
	}
</style>
