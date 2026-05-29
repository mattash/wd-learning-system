import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const cookieSet = vi.hoisted(() => vi.fn());
const navigationMocks = vi.hoisted(() => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    set: cookieSet,
  })),
}));

vi.mock("next/navigation", () => ({
  redirect: navigationMocks.redirect,
}));

vi.mock("@/lib/authz", () => ({
  hasCompletedOnboarding: vi.fn(),
  requireAuth: vi.fn(),
}));

vi.mock("@/lib/e2e-mode", () => ({
  isE2ESmokeMode: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseAdminClient: vi.fn(),
}));

import SelectParishPage from "@/app/app/select-parish/page";
import { hasCompletedOnboarding, requireAuth } from "@/lib/authz";
import { isE2ESmokeMode } from "@/lib/e2e-mode";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

function findJoinAction(node: React.ReactNode): ((formData: FormData) => Promise<void>) | null {
  if (!React.isValidElement(node)) return null;
  const element = node as React.ReactElement<{
    action?: (formData: FormData) => Promise<void>;
    children?: React.ReactNode;
  }>;

  if (element.type === "form" && typeof element.props.action === "function") {
    return element.props.action;
  }

  const children = React.Children.toArray(element.props.children);
  for (const child of children) {
    const action = findJoinAction(child);
    if (action) return action;
  }

  return null;
}

describe("SelectParishPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuth).mockResolvedValue("user-1");
    vi.mocked(hasCompletedOnboarding).mockResolvedValue(true);
    vi.mocked(isE2ESmokeMode).mockReturnValue(false);
  });

  it("does not overwrite an existing membership role when joining from a stale form", async () => {
    const insert = vi.fn();
    const upsert = vi.fn();
    const openParishes = [{ id: "parish-1", name: "St Mary", slug: "st-mary" }];

    vi.mocked(getSupabaseAdminClient).mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "parishes") {
          return {
            select: vi.fn((columns: string) => {
              if (columns === "id,name,slug") {
                return {
                  eq: vi.fn(() => ({
                    order: vi.fn(async () => ({ data: openParishes, error: null })),
                  })),
                };
              }

              return {
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    maybeSingle: vi.fn(async () => ({ data: { id: "parish-1" }, error: null })),
                  })),
                })),
              };
            }),
          };
        }

        if (table === "parish_memberships") {
          return {
            insert,
            upsert,
            select: vi.fn((columns: string) => {
              if (columns === "parishes(id,name,slug)") {
                return {
                  eq: vi.fn(async () => ({ data: [], error: null })),
                };
              }

              return {
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    maybeSingle: vi.fn(async () => ({ data: { id: "membership-1" }, error: null })),
                  })),
                })),
              };
            }),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    } as never);

    const page = await SelectParishPage({ searchParams: Promise.resolve({ manage: "1" }) });
    const action = findJoinAction(page);
    expect(action).toBeTypeOf("function");

    const formData = new FormData();
    formData.set("parishId", "parish-1");

    await expect(action?.(formData)).rejects.toThrow("NEXT_REDIRECT:/app");

    expect(insert).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
    expect(cookieSet).toHaveBeenCalledWith(
      "active_parish_id",
      "parish-1",
      expect.objectContaining({ httpOnly: true }),
    );
  });
});
