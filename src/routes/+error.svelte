<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
</script>

<svelte:head>
	<title>{page.status === 404 ? 'Page not found' : 'Something went wrong'} · net-time</title>
</svelte:head>

<main>
	<h1>{page.status === 404 ? 'Page not found' : 'Something went wrong'}</h1>
	{#if page.status !== 404}
		<p>Please try again in a moment.</p>
	{/if}
	{#if page.error?.id}
		<p>Reference: <code>{page.error.id}</code></p>
	{/if}
	<p><a href={resolve('/')}>Back to home</a></p>
</main>
