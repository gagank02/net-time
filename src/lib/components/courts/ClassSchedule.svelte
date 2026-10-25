<script lang="ts">
	import ExternalLink from '#lib/components/ExternalLink.svelte';
	import { dayRanges, formatClock, formatDate } from '#lib/courts/status.js';
	import type { ClassDetail } from '#lib/courts/types.js';

	let { classes, courtCount }: { classes: ClassDetail[]; courtCount: number } = $props();

	// The same block on several days collapses into one line ("Mon–Fri 9 AM – Noon").
	const blocks = $derived.by(() => {
		const groups = new Map<string, { c: ClassDetail; days: number[] }>();
		for (const c of classes) {
			const key = [
				c.title,
				c.starts,
				c.ends,
				c.courtsUsed,
				c.seasonStart,
				c.seasonEnd,
				c.sourceUrl
			].join('|');
			const g = groups.get(key);
			if (g) g.days.push(c.weekday);
			else groups.set(key, { c, days: [c.weekday] });
		}
		// Monday-first, matching the day ranges.
		const order = (g: { days: number[] }) => Math.min(...g.days.map((d) => (d + 6) % 7));
		return [...groups.values()].sort((a, b) => order(a) - order(b));
	});
</script>

<ul class="blocks" role="list">
	{#each blocks as { c, days } (c.title + c.starts + days.join())}
		<li>
			<p class="when">{dayRanges(days)} · {formatClock(c.starts)} – {formatClock(c.ends)}</p>
			<p class="what">{c.title}</p>
			<p class="meta">
				Uses {Math.min(c.courtsUsed, courtCount)} of {courtCount}
				{courtCount === 1 ? 'court' : 'courts'} · {formatDate(c.seasonStart)} – {formatDate(
					c.seasonEnd
				)}
			</p>
			<p class="meta">
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
