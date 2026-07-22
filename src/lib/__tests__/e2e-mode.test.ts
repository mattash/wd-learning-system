import { describe, expect, it } from "vitest";

import { isE2ESmokeMode } from "@/lib/e2e-mode";

describe("isE2ESmokeMode", () => {
  it("returns false when no flags are set", () => {
    expect(isE2ESmokeMode({})).toBe(false);
  });

  it("returns false when only the primary flag is set", () => {
    expect(isE2ESmokeMode({ E2E_SMOKE_MODE: "1" })).toBe(false);
  });

  it("returns false when the acknowledgement is wrong", () => {
    expect(
      isE2ESmokeMode({
        E2E_SMOKE_MODE: "1",
        E2E_SMOKE_MODE_ACK: "wrong",
        NODE_ENV: "development",
      }),
    ).toBe(false);
  });

  it("returns true when both flags are set in development", () => {
    expect(
      isE2ESmokeMode({
        E2E_SMOKE_MODE: "1",
        E2E_SMOKE_MODE_ACK: "local-smoke-only",
        NODE_ENV: "development",
      }),
    ).toBe(true);
  });

  it("returns true when both flags are set in test", () => {
    expect(
      isE2ESmokeMode({
        E2E_SMOKE_MODE: "1",
        E2E_SMOKE_MODE_ACK: "local-smoke-only",
        NODE_ENV: "test",
      }),
    ).toBe(true);
  });

  it("returns false when both flags are set in production", () => {
    expect(
      isE2ESmokeMode({
        E2E_SMOKE_MODE: "1",
        E2E_SMOKE_MODE_ACK: "local-smoke-only",
        NODE_ENV: "production",
      }),
    ).toBe(false);
  });
});
