// Unit-test stand-in for the `cloudflare:workers` module (aliased in vite.config.ts).
// Tests set bindings directly: `env.RL_WRITE = fakeLimiter(2)`.
export const env: Record<string, unknown> = {};
