import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AdminParishManager } from "@/components/admin-parish-manager";
import type { DioceseParishRow } from "@/lib/repositories/diocese-admin";

const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

function parish(overrides: Partial<DioceseParishRow>): DioceseParishRow {
  return {
    id: "parish-1",
    name: "Existing Parish",
    slug: "existing-parish",
    allow_self_signup: true,
    archived_at: null,
    created_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("AdminParishManager", () => {
  beforeEach(() => {
    refresh.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("saves a parish added by refreshed props before any field changes", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const initialParish = parish({ id: "parish-1" });
    const refreshedParish = parish({
      id: "parish-2",
      name: "Refreshed Parish",
      slug: "refreshed-parish",
      allow_self_signup: false,
    });

    const { rerender } = render(<AdminParishManager parishes={[initialParish]} />);
    rerender(<AdminParishManager parishes={[initialParish, refreshedParish]} />);

    const refreshedRow = screen.getByDisplayValue("Refreshed Parish").closest("tr");
    expect(refreshedRow).not.toBeNull();

    fireEvent.click(within(refreshedRow as HTMLTableRowElement).getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/parishes/parish-2",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({
            name: "Refreshed Parish",
            slug: "refreshed-parish",
            allowSelfSignup: false,
          }),
        }),
      ),
    );
    expect(refresh).toHaveBeenCalled();
  });
});
