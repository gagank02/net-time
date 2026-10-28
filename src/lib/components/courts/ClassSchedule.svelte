<script lang="ts">
	import ExternalLink from '#lib/components/ExternalLink.svelte';
	import { dayRanges, formatClock, formatDate } from '#lib/courts/status.js';
	import type { ClassDetail } from '#lib/courts/types.js';

	let { classes, courtCount }: { classes: ClassDetail[]; courtCount: number } = $props();

	/** Programs with more sessions than this start collapsed. */
	const openUpTo = 3;

	const shortDate = (date: string) => formatDate(date).replace(/, \d{4}$/, '');
	const fee = (n: number) => (n === 0 ? 'Free' : `$${n}`);
	const dates = (c: ClassDetail) =>
		c.seasonStart === c.seasonEnd
			? shortDate(c.seasonStart)
			: `${shortDate(c.seasonStart)} – ${shortDate(c.seasonEnd)}`;
	const who = (c: ClassDetail) =>
		[c.ages, c.fee === null ? null : fee(c.fee)].filter(Boolean).join(' · ');

	// One entry per program title (a league runs as many sessions), sorted by title; its sessions
	// by date. Ages and fee show once when every session shares them.
	const programs = $derived.by(() => {
		// eslint-disable-next-line svelte/prefer-svelte-reactivity -- scratch map, rebuilt on each run
		const byTitle = new Map<string, ClassDetail[]>();
		for (const c of classes) byTitle.set(c.title, [...(byTitle.get(c.title) ?? []), c]);
		return [...byTitle]
			.map(([title, sessions]) => {
				sessions.sort(
					(a, b) => a.seasonStart.localeCompare(b.seasonStart) || a.starts.localeCompare(b.starts)
				);
				const shared = new Set(sessions.map(who)).size === 1 ? who(sessions[0]) : null;
				const days = [...new Set(sessions.flatMap((s) => s.weekdays))];
				return { title, sessions, shared, days };
			})
			.sort((a, b) => a.title.localeCompare(b.title, 'en', { numeric: true }));
	});

	const checked = $derived(classes.map((c) => c.verifiedAt).sort()[0]);
</script>

{#snippet session(s: ClassDetail, showWho: boolean)}
	<li>
		<p class="when">
			{dayRanges(s.weekdays)} · {formatClock(s.starts)} – {formatClock(s.ends)} · {dates(s)}
		</p>
		{#if showWho && who(s)}<p class="meta">{who(s)}</p>{/if}
		{#if s.courtsUsed !== null}
			<p class="meta">
				Uses {Math.min(s.courtsUsed, courtCount)} of {courtCount}
				{courtCount === 1 ? 'court' : 'courts'}
			</p>
		{/if}
		{#if s.except.length}
			<p class="meta">No class {s.except.map(shortDate).join(', ')}</p>
		{/if}
		<p class="meta">
			{#if s.signupUrl}<ExternalLink href={s.signupUrl}>Sign up</ExternalLink> ·{/if}
			<ExternalLink href={s.sourceUrl}>Source</ExternalLink>
		</p>
	</li>
{/snippet}

<ul class="programs" role="list">
	{#each programs as p (p.title)}
		<li>
			<p class="what">{p.title}</p>
			{#if p.shared}<p class="meta">{p.shared}</p>{/if}
			{#if p.sessions.length > openUpTo}
				<details>
					<summary>{p.sessions.length} sessions · {dayRanges(p.days)}</summary>
					<ul class="sessions" role="list">
						{#each p.sessions as s, i (i)}{@render session(s, !p.shared)}{/each}
					</ul>
				</details>
			{:else}
				<ul class="sessions" role="list">
					{#each p.sessions as s, i (i)}{@render session(s, !p.shared)}{/each}
				</ul>
			{/if}
		</li>
	{/each}
</ul>
<p class="checked">
	{programs.length}
	{programs.length === 1 ? 'program' : 'programs'} · schedules checked {formatDate(checked)}
</p>

<style>
	.programs > li {
		display: grid;
		gap: 2px;
		padding: var(--space-3) 0;
	}

	.programs > li + li {
		border-top: 0.5px solid var(--separator);
	}

	.what {
		font-weight: 600;
		font-size: var(--text-subhead);
	}

	.sessions {
		display: grid;
		gap: var(--space-2);
		margin-top: var(--space-1);
	}

	.when {
		font-size: var(--text-subhead);
	}

	.meta,
	.checked {
		color: var(--label-2);
		font-size: var(--text-footnote);
	}

	.checked {
		padding-top: var(--space-3);
		border-top: 0.5px solid var(--separator);
	}

	summary {
		display: flex;
		align-items: center;
		min-height: var(--target);
		color: var(--link);
		font-size: var(--text-subhead);
		list-style: none;
		cursor: pointer;
	}

	summary::-webkit-details-marker {
		display: none;
	}

	/* Chevron: points down when closed, up when open. */
	summary::after {
		content: '';
		width: 0.45em;
		height: 0.45em;
		margin-left: var(--space-2);
		border-right: 2px solid currentColor;
		border-bottom: 2px solid currentColor;
		transform: translateY(-25%) rotate(45deg);
		transition: transform 0.2s var(--ease);
	}

	details[open] > summary::after {
		transform: translateY(25%) rotate(-135deg);
	}

	summary:focus-visible {
		outline: 3px solid var(--focus);
		outline-offset: 2px;
		border-radius: var(--radius-control);
	}
</style>
