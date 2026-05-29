import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AdminAuditLogViewer } from "@/components/admin-audit-log-viewer";

describe("AdminAuditLogViewer", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("clears loading and shows an error when audit log loading rejects", async () => {
    vi.spyOn(global, "fetch").mockRejectedValue(new Error("network error"));

    render(<AdminAuditLogViewer initialLogs={[]} />);

    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    expect(await screen.findByText("Failed to load audit logs.")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText("Loading logs...")).not.toBeInTheDocument());
    expect(screen.getByText("Showing 0 entries")).toBeInTheDocument();
  });
});
