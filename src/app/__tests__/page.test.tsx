import { beforeEach, describe, expect, it, vi } from "vitest";

const navigationMocks = vi.hoisted(() => ({
  redirect: vi.fn(),
}));

vi.mock("next/navigation", () => navigationMocks);

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
}));

import { auth } from "@clerk/nextjs/server";

import Home from "@/app/page";

describe("Home", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects anonymous visitors to the public catalog", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null } as Awaited<ReturnType<typeof auth>>);

    await Home();

    expect(navigationMocks.redirect).toHaveBeenCalledWith("/catalog");
  });

  it("redirects signed-in visitors to their dashboard", async () => {
    vi.mocked(auth).mockResolvedValue({ userId: "user-1" } as Awaited<ReturnType<typeof auth>>);

    await Home();

    expect(navigationMocks.redirect).toHaveBeenCalledWith("/app/dashboard");
    expect(navigationMocks.redirect).not.toHaveBeenCalledWith("/catalog");
  });
});
