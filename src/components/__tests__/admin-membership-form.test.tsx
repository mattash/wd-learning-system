import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AdminMembershipForm } from "@/components/admin-membership-form";

describe("AdminMembershipForm", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("prevents duplicate membership submissions while saving", async () => {
    let resolveFetch: (response: Response) => void;
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );

    vi.stubGlobal("fetch", fetchMock);

    render(<AdminMembershipForm />);

    fireEvent.click(screen.getByRole("button", { name: "Add membership" }));
    fireEvent.click(screen.getByRole("button", { name: "Saving..." }));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Saving..." })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Saving..." })).toHaveAttribute("aria-busy", "true");

    resolveFetch!({
      ok: true,
      json: async () => ({}),
    } as Response);

    await waitFor(() => expect(screen.getByRole("button", { name: "Add membership" })).toBeEnabled());
    expect(screen.getByText("Saved")).toBeInTheDocument();
  });
});
