/**
 * A "now" that starts at the server's time (so SSR and hydration agree) and then ticks every minute
 * in the browser, so open/closed statuses stay right in a tab left open. Call during component init.
 */
export function liveNow(serverNow: () => string) {
	let now = $derived(new Date(serverNow()));
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
