<script lang="ts">
	import {
		addDays,
		chicagoTime,
		dayName,
		formatClock,
		intervalsOn,
		toClock
	} from '#lib/courts/status.js';
	import type { HoursRow } from '#lib/courts/types.js';

	let { hours, now }: { hours: HoursRow[]; now: Date } = $props();

	// The coming week's hours (seasonal rows apply on their actual dates), Sunday first, today marked.
	const week = $derived.by(() => {
		const today = chicagoTime(now);
		return [0, 1, 2, 3, 4, 5, 6].map((weekday) => {
			const date = addDays(today.date, (weekday - today.weekday + 7) % 7);
			const spans = intervalsOn(hours, date, weekday).map(
				(i) => `${formatClock(toClock(i.opens))} – ${formatClock(toClock(i.closes))}`
			);
			return { weekday, isToday: weekday === today.weekday, text: spans.join(', ') || 'Closed' };
		});
	});
</script>

<table>
	<caption class="visually-hidden">Opening hours this week</caption>
	<tbody>
		{#each week as day (day.weekday)}
			<tr class:today={day.isToday} aria-current={day.isToday ? 'date' : undefined}>
				<th scope="row"
					>{dayName(day.weekday)}{#if day.isToday}<span class="tag">Today</span>{/if}</th
				>
				<td>{day.text}</td>
			</tr>
		{/each}
	</tbody>
</table>

<style>
	table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--text-subhead);
	}

	th,
	td {
		padding: var(--space-2) 0;
		text-align: left;
		font-weight: 400;
	}

	td {
		text-align: right;
		color: var(--label-2);
	}

	tr + tr th,
	tr + tr td {
		border-top: 0.5px solid var(--separator);
	}

	.today th,
	.today td {
		color: var(--label);
		font-weight: 600;
	}

	.tag {
		margin-left: var(--space-2);
		color: var(--tint);
		font-size: var(--text-footnote);
	}
</style>
