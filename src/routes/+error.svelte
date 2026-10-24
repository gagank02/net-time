<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
</script>

<svelte:head>
	<title>{page.status === 404 ? 'Page not found' : 'Something went wrong'} · net-time</title>
</svelte:head>

<section class="error">
	<h1>{page.status === 404 ? 'Page not found' : 'Something went wrong'}</h1>
	{#if page.status !== 404}
		<p>Please try again in a moment.</p>
	{/if}
	{#if page.error?.id}
		<p>Reference: <code>{page.error.id}</code></p>
	{/if}
	<p><a href={resolve('/')}>Back to home</a></p>
</section>

<style>
	.error {
		display: grid;
		gap: var(--space-3);
		padding: var(--space-8) 0;
	}

	h1 {
		font-size: var(--text-large-title);
		font-weight: 700;
	}

	p {
		color: var(--label-2);
	}
</style>
