<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import Button from '#lib/components/Button.svelte';
	import ExternalLink from '#lib/components/ExternalLink.svelte';
	import FormErrors from '#lib/components/FormErrors.svelte';
	import TextField from '#lib/components/TextField.svelte';
	import ClassSchedule from '#lib/components/courts/ClassSchedule.svelte';
	import CourtFacts from '#lib/components/courts/CourtFacts.svelte';
	import HoursTable from '#lib/components/courts/HoursTable.svelte';
	import { liveNow } from '#lib/courts/clock.svelte.js';
	import { githubIssuesUrl } from '#lib/legal.js';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const court = $derived(data.court);
	const clock = liveNow();
	const errors: Record<string, string> = $derived(form?.errors ?? {});
	const values = $derived(form && 'values' in form ? (form.values ?? {}) : {});
	const courtPage = $derived(resolve('/courts/[slug]', { slug: court.slug }));

	const topics = [
		{ value: 'hours', label: 'Hours' },
		{ value: 'class', label: 'A class or program' },
		{ value: 'surface', label: 'Surface' },
		{ value: 'lights', label: 'Lights' },
		{ value: 'court_count', label: 'Number of courts' },
		{ value: 'access', label: 'Free, fee or reservation' },
		{ value: 'name', label: 'Name' },
		{ value: 'closed', label: 'Courts closed or gone' },
		{ value: 'other', label: 'Something else' }
	];
	const labels = {
		topics: 'What’s wrong',
		details: 'What’s right',
		seen_on: 'Date you were there'
	};

	// Turnstile (Cloudflare's bot check) loads on this page only, after hydration; its origin is in
	// this page's CSP alone. It adds the cf-turnstile-response field to the form itself.
	let widget: HTMLDivElement | undefined = $state();
	onMount(() => {
		if (!widget || !data.siteKey) return;
		const el = widget;
		const script = document.createElement('script');
		script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
		script.async = true;
		script.onload = () =>
			window.turnstile?.render(el, {
				sitekey: data.siteKey,
				action: 'correction',
				theme: 'auto',
				size: 'flexible'
			});
		document.head.appendChild(script);
	});
</script>

<svelte:head>
	<title>Suggest a correction · {court.name} · net-time</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<a class="back" href={courtPage}>‹ {court.name}</a>

<header class="title">
	<h1>Suggest a correction</h1>
	<p class="area">{court.name} · {court.communityArea}</p>
</header>

{#if data.sent}
	<section class="card thanks" aria-labelledby="thanks-h">
		<h2 id="thanks-h">Thanks, we got it</h2>
		<p>We’ll check it against an official source before changing anything.</p>
		<p><a href={courtPage}>Back to {court.name}</a></p>
	</section>
{:else}
	<section aria-labelledby="now-h">
		<h2 id="now-h" class="section-title">What we list now</h2>
		<CourtFacts {court} />
		<div class="card hours">
			<HoursTable hours={court.hours} now={clock.current} builtAt={data.builtAt} />
		</div>
		{#if court.classes.length}
			<details class="card classes">
				<summary>Classes and programs ({court.classes.length})</summary>
				<ClassSchedule classes={court.classes} courtCount={court.courtCount} />
			</details>
		{/if}
	</section>

	<section aria-labelledby="form-h">
		<h2 id="form-h" class="section-title">Your correction</h2>
		{#if data.siteKey}
			<form method="POST" class="card form">
				<FormErrors {errors} {labels} />
				<p class="note">
					No account needed, and we don’t ask who you are. Please don’t include your name or contact
					details.
				</p>
				<!-- Native fields with initial values only (no binding): hydration then leaves anything
				     typed before the page finished loading alone. -->
				<fieldset
					class="field"
					class:invalid={errors.topics}
					aria-describedby={errors.topics ? 'field-topics-error' : undefined}
				>
					<legend>{labels.topics} <span class="hint">Choose all that apply.</span></legend>
					<div class="choices">
						{#each topics as topic, i (topic.value)}
							<label class="choice">
								<input
									type="checkbox"
									name="topics"
									value={topic.value}
									id={i === 0 ? 'field-topics' : undefined}
									checked={values.topics?.includes(topic.value)}
								/>
								{topic.label}
							</label>
						{/each}
					</div>
					{#if errors.topics}<p class="error" id="field-topics-error">{errors.topics}</p>{/if}
				</fieldset>
				<div class="field">
					<label for="field-details">{labels.details}</label>
					<textarea
						id="field-details"
						name="details"
						rows="4"
						maxlength="1000"
						required
						aria-invalid={errors.details ? 'true' : undefined}
						aria-describedby="field-details-hint{errors.details ? ' field-details-error' : ''}"
						defaultValue={values.details ?? ''}></textarea>
					<p class="hint" id="field-details-hint">
						For example: “Lights were removed this summer.” If several things are wrong, cover each
						one. Up to 1,000 characters, no links.
					</p>
					{#if errors.details}<p class="error" id="field-details-error">{errors.details}</p>{/if}
				</div>
				<TextField
					label="{labels.seen_on} (optional)"
					name="seen_on"
					type="date"
					min={data.yearAgo}
					max={data.today}
					value={values.seen_on ?? ''}
					error={errors.seen_on}
				/>
				<!-- Honeypot: hidden from people and assistive tech; bots fill it in. -->
				<div class="trap" aria-hidden="true">
					<label for="company_fax">Fax</label>
					<input id="company_fax" name="company_fax" tabindex="-1" autocomplete="off" />
				</div>
				<div class="turnstile" bind:this={widget}></div>
				<noscript>
					<p class="note">
						This form needs JavaScript for its spam check. You can also
						<ExternalLink href={githubIssuesUrl}>report the problem on GitHub</ExternalLink>
						(needs a GitHub account; reports there are public).
					</p>
				</noscript>
				<Button type="submit">Send correction</Button>
			</form>
		{:else}
			<p class="card note">
				Corrections aren’t available right now.
				<ExternalLink href={githubIssuesUrl}>Report the problem on GitHub</ExternalLink> instead.
			</p>
		{/if}
		<p class="footnote">
			We keep only what you send here, never your name, email or IP address. See
			<a href={resolve('/privacy')}>Privacy</a>.
		</p>
	</section>
{/if}

<style>
	.back {
		display: inline-flex;
		align-items: center;
		min-height: var(--target);
		font-size: var(--text-body);
	}

	.title {
		display: grid;
		gap: var(--space-1);
		margin-bottom: var(--space-6);
	}

	h1 {
		font-size: var(--text-large-title);
		font-weight: 700;
	}

	.area {
		color: var(--label-2);
	}

	section {
		display: grid;
		gap: var(--space-3);
		margin-top: var(--space-6);
	}

	.section-title {
		padding: 0 var(--space-4);
		color: var(--label-2);
		font-size: var(--text-footnote);
		font-weight: 400;
		text-transform: uppercase;
		letter-spacing: 0.02em;
	}

	.card {
		padding: var(--space-2) var(--space-4);
		border-radius: var(--radius-card);
		background: var(--card);
	}

	.classes summary {
		min-height: var(--target);
		display: flex;
		align-items: center;
		cursor: pointer;
	}

	.thanks {
		display: grid;
		gap: var(--space-2);
		padding: var(--space-4);
	}

	.thanks h2 {
		font-size: var(--text-title-3);
		font-weight: 600;
	}

	.form {
		display: grid;
		gap: var(--space-4);
		padding: var(--space-4);
	}

	.note {
		color: var(--label-2);
		font-size: var(--text-subhead);
	}

	.field {
		display: grid;
		gap: var(--space-1);
	}

	.field label {
		padding: 0 var(--space-1);
		font-size: var(--text-subhead);
		font-weight: 500;
	}

	fieldset {
		margin: 0;
		padding: 0;
		border: 0;
	}

	legend {
		padding: 0 var(--space-1) var(--space-1);
		font-size: var(--text-subhead);
		font-weight: 500;
	}

	legend .hint {
		padding: 0;
		font-weight: 400;
	}

	.choices {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(12rem, 1fr));
		border-radius: var(--radius-control);
		background: var(--fill);
	}

	fieldset.invalid .choices {
		outline: 1px solid var(--danger);
	}

	.choice {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		min-height: var(--target);
		padding: 0 var(--space-3);
		cursor: pointer;
	}

	.choice input {
		flex: none;
		width: 1.25rem;
		height: 1.25rem;
		margin: 0;
		accent-color: var(--tint);
	}

	textarea {
		padding: var(--space-2) var(--space-3);
		border: 1px solid transparent;
		border-radius: var(--radius-control);
		background: var(--fill);
		font: inherit;
		font-size: var(--text-body); /* ≥16px stops iOS zooming on focus */
		resize: vertical;
	}

	textarea[aria-invalid='true'] {
		border-color: var(--danger);
	}

	.hint,
	.error {
		padding: 0 var(--space-1);
		font-size: var(--text-footnote);
	}

	.hint {
		color: var(--label-2);
	}

	.error {
		color: var(--danger);
	}

	.trap {
		position: absolute;
		left: -10000px;
		width: 1px;
		height: 1px;
		overflow: hidden;
	}

	.turnstile:empty {
		display: none;
	}

	.footnote {
		padding: 0 var(--space-4);
		color: var(--label-2);
		font-size: var(--text-footnote);
	}
</style>
