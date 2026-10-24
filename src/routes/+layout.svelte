<script lang="ts">
	import '../app.css';
	import favicon from '#lib/assets/favicon.svg';
	import AppShell from '#lib/components/AppShell.svelte';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<AppShell theme={data.theme}>
	{@render children()}
</AppShell>
