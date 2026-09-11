interface E2ESmokeEnvironment {
  E2E_SMOKE_MODE?: string;
  E2E_SMOKE_MODE_ACK?: string;
  NODE_ENV?: string;
}

interface E2EAuthBypassEnvironment extends E2ESmokeEnvironment {
  E2E_AUTH_BYPASS?: string;
}

export function isE2ESmokeMode(
  env: E2ESmokeEnvironment = {
    E2E_SMOKE_MODE: process.env.E2E_SMOKE_MODE,
    E2E_SMOKE_MODE_ACK: process.env.E2E_SMOKE_MODE_ACK,
    NODE_ENV: process.env.NODE_ENV,
  },
) {
  return (
    env.E2E_SMOKE_MODE === "1" &&
    env.E2E_SMOKE_MODE_ACK === "local-smoke-only" &&
    env.NODE_ENV !== "production"
  );
}

/**
 * True when the E2E harness may impersonate a test user via `requireAuth`.
 *
 * The fixture-based smoke suite enables this via `E2E_SMOKE_MODE`. The
 * real-Supabase suite leaves smoke mode OFF (so repositories hit the real
 * database) but still needs to skip Clerk sign-in, so it sets
 * `E2E_AUTH_BYPASS=1` instead.
 */
export function isE2EAuthBypass(
  env: E2EAuthBypassEnvironment = {
    E2E_SMOKE_MODE: process.env.E2E_SMOKE_MODE,
    E2E_SMOKE_MODE_ACK: process.env.E2E_SMOKE_MODE_ACK,
    E2E_AUTH_BYPASS: process.env.E2E_AUTH_BYPASS,
    NODE_ENV: process.env.NODE_ENV,
  },
) {
  return env.E2E_AUTH_BYPASS === "1" || isE2ESmokeMode(env);
}
