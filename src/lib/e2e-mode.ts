export function isE2ESmokeMode() {
  return process.env.E2E_SMOKE_MODE === "1";
}
