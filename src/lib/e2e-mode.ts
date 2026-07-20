interface E2ESmokeEnvironment {
  E2E_SMOKE_MODE?: string;
  E2E_SMOKE_MODE_ACK?: string;
  NODE_ENV?: string;
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
