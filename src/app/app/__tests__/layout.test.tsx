import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const headerMock = vi.hoisted(() => ({
  AppHeaderClient: vi.fn(() => <header>App header</header>),
}));

vi.mock("@/components/app-header-client", () => headerMock);

vi.mock("@/components/help-panel", () => ({
  HelpPanel: () => <div>Help panel</div>,
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

vi.mock("@/lib/e2e-mode", () => ({
  isE2ESmokeMode: vi.fn(() => true),
}));

vi.mock("@/lib/authz", () => ({
  getActiveParishRole: vi.fn(),
  isDioceseAdmin: vi.fn(),
  requireAuth: vi.fn(),
}));

import AppLayout from "@/app/app/layout";
import { AppHeaderClient } from "@/components/app-header-client";
import { getActiveParishRole, isDioceseAdmin, requireAuth } from "@/lib/authz";
import { cookies } from "next/headers";

describe("AppLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuth).mockResolvedValue("user-1");
    vi.mocked(isDioceseAdmin).mockResolvedValue(false);
    vi.mocked(cookies).mockResolvedValue({
      get: vi.fn(() => undefined),
    } as unknown as Awaited<ReturnType<typeof cookies>>);
  });

  it("shows the Parish Admin nav item for active parish admins", async () => {
    vi.mocked(getActiveParishRole).mockResolvedValue("parish_admin");

    render(await AppLayout({ children: <div>Content</div> }));

    expect(AppHeaderClient).toHaveBeenCalledWith(
      expect.objectContaining({
        navItems: expect.arrayContaining([{ label: "Parish Admin", href: "/app/parish-admin" }]),
      }),
      undefined,
    );
  });
});
