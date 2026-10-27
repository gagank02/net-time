/* eslint-disable svelte/prefer-svelte-reactivity -- each tick assigns a new Date, none is mutated */
/**
 * The browser's "now", ticking every minute so statuses stay right in a tab left open.
 * Null until the page hydrates: court pages are prerendered, so the HTML can't know the time, and
 * the first client render must match it. Call during component init.
 */
export function liveNow() {
	let now = $state<Date | null>(null);
	$effect(() => {
		now = new Date();
		const timer = setInterval(() => (now = new Date()), 60_000);
		return () => clearInterval(timer);
	});
	return {
		get current() {
			return now;
		}
	};
}
