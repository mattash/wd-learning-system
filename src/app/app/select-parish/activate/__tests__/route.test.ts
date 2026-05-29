import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    set: vi.fn(),
  })),
}));

vi.mock("@/lib/authz", () => ({
  requireAuth: vi.fn(),
}));

vi.mock("@/lib/e2e-mode", () => ({
  isE2ESmokeMode: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseAdminClient: vi.fn(),
}));

import { GET } from "@/app/app/select-parish/activate/route";
import { requireAuth } from "@/lib/authz";
import { isE2ESmokeMode } from "@/lib/e2e-mode";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

describe("GET /app/select-parish/activate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuth).mockResolvedValue("user-1");
    vi.mocked(isE2ESmokeMode).mockReturnValue(false);
  });

  it("surfaces Supabase membership lookup errors instead of invalid membership redirects", async () => {
    const maybeSingle = vi.fn(async () => ({
      data: null,
      error: { message: "database unavailable" },
    }));
    const query: {
      select: ReturnType<typeof vi.fn>;
      eq: ReturnType<typeof vi.fn>;
      maybeSingle: typeof maybeSingle;
    } = {
      select: vi.fn(() => query),
      eq: vi.fn(() => query),
      maybeSingle,
    };
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn(() => query),
    } as never);

    await expect(
      GET(new Request("http://localhost/app/select-parish/activate?parishId=parish-1")),
    ).rejects.toThrow("Unable to verify parish membership");

    expect(consoleError).toHaveBeenCalledWith(
      "[select-parish] membership lookup failed:",
      { message: "database unavailable" },
    );
  });
});
