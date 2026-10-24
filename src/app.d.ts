// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		interface Platform {
			env: Env;
			ctx: ExecutionContext;
			caches: CacheStorage;
			cf?: IncomingRequestCfProperties;
		}

		interface Error {
			/** Request id shown to the user and present in server logs, for support lookups. */
			id?: string;
		}
		interface Locals {
			requestId: string;
		}
		// interface PageData {}
		// interface PageState {}
	}
}

export {};
