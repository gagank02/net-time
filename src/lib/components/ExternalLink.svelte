<script lang="ts">
	import type { Snippet } from 'svelte';

	// External links open in a new tab. noopener/noreferrer stop the new page from controlling this
	// tab (reverse tabnabbing) or learning which page linked to it.
	let { href, children }: { href: string; children: Snippet } = $props();
</script>

<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- external URLs, not app routes -->
<a {href} target="_blank" rel="noopener noreferrer"
	>{@render children()}<span class="visually-hidden"> (opens in a new tab)</span></a
>
