import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AdminUserAccessManager } from "@/components/admin-user-access-manager";

const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

describe("AdminUserAccessManager", () => {
  beforeEach(() => {
    refresh.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows a failure message when the access request rejects", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network error")));

    render(<AdminUserAccessManager />);

    fireEvent.click(screen.getByRole("button", { name: "Apply access update" }));

    expect(await screen.findByText("Failed to update access.")).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("renders all three access-control checkboxes", () => {
    render(<AdminUserAccessManager />);

    const labels = [
      "Make diocese admin",
      "Remove diocese admin",
      "Remove parish membership (requires parish_id)",
    ];

    for (const label of labels) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }

    expect(screen.getAllByRole("checkbox")).toHaveLength(3);
    expect(screen.getByRole("button", { name: "Apply access update" })).toBeInTheDocument();
  });

  it("shows a failure message when an error response has invalid JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => {
          throw new Error("invalid json");
        },
      }),
    );

    render(<AdminUserAccessManager />);

    fireEvent.click(screen.getByRole("button", { name: "Apply access update" }));

    expect(await screen.findByText("Failed to update access.")).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });
});
