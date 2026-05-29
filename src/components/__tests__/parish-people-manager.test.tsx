import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ParishPeopleManager } from "@/components/parish-people-manager";

const baseMembers = [
  { clerk_user_id: "user_a", role: "student" as const, email: "a@test.com", display_name: "Alice" },
  { clerk_user_id: "user_b", role: "instructor" as const, email: "b@test.com", display_name: "Bob" },
];

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

describe("ParishPeopleManager", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders members list", () => {
    render(<ParishPeopleManager members={baseMembers} />);
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });

  it("shows error when addMember fetch rejects", async () => {
    vi.spyOn(global, "fetch").mockRejectedValue(new Error("network error"));

    render(<ParishPeopleManager members={baseMembers} />);

    const inputs = screen.getAllByRole("textbox");
    fireEvent.change(inputs[0], { target: { value: "new@test.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Add member" }));

    expect(await screen.findByText("Failed to add member.")).toBeInTheDocument();
  });

  it("shows error when addMember returns non-ok", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Already a member" }),
    } as Response);

    render(<ParishPeopleManager members={baseMembers} />);

    const inputs = screen.getAllByRole("textbox");
    fireEvent.change(inputs[0], { target: { value: "new@test.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Add member" }));

    expect(await screen.findByText("Already a member")).toBeInTheDocument();
  });

  it("shows error when updateRole fetch rejects", async () => {
    vi.spyOn(global, "fetch").mockRejectedValue(new Error("network error"));

    render(<ParishPeopleManager members={baseMembers} />);

    fireEvent.click(screen.getAllByRole("button", { name: "Save role" })[0]);

    expect(await screen.findByText("Failed to update role.")).toBeInTheDocument();
  });

  it("shows error when removeMember fetch rejects", async () => {
    vi.spyOn(global, "fetch").mockRejectedValue(new Error("network error"));

    render(<ParishPeopleManager members={baseMembers} />);

    fireEvent.click(screen.getAllByRole("button", { name: "Remove" })[0]);

    expect(await screen.findByText("Failed to remove member.")).toBeInTheDocument();
  });

  it("shows error when importMembers fetch rejects", async () => {
    vi.spyOn(global, "fetch").mockRejectedValue(new Error("network error"));

    render(<ParishPeopleManager members={baseMembers} />);

    fireEvent.click(screen.getByRole("button", { name: "Import CSV" }));

    expect(await screen.findByText("Failed to import members.")).toBeInTheDocument();
  });

  it("shows error when non-json response is received", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: false,
      json: async () => {
        throw new SyntaxError("Unexpected end of JSON input");
      },
    } as unknown as Response);

    render(<ParishPeopleManager members={baseMembers} />);

    fireEvent.click(screen.getAllByRole("button", { name: "Remove" })[0]);

    expect(await screen.findByText("Failed to remove member.")).toBeInTheDocument();
  });

  it("drafts stay in sync after members prop changes", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as Response);

    const { rerender } = render(<ParishPeopleManager members={baseMembers} />);

    // Verify initial select values
    const selects = screen.getAllByRole("combobox");
    // [0]=newRole, [1]=importDefaultRole, [2]=Alice's role, [3]=Bob's role
    expect(selects[2]).toHaveValue("student"); // Alice
    expect(selects[3]).toHaveValue("instructor"); // Bob

    // Change Alice's role via rerender with updated members (simulating server-side change)
    const updated = [
      { clerk_user_id: "user_a", role: "instructor" as const, email: "a@test.com", display_name: "Alice" },
      { clerk_user_id: "user_b", role: "instructor" as const, email: "b@test.com", display_name: "Bob" },
    ];

    rerender(<ParishPeopleManager members={updated} />);

    await waitFor(() => {
      const updatedSelects = screen.getAllByRole("combobox");
      expect(updatedSelects[2]).toHaveValue("instructor");
    });
  });

  it("drafts reset to server role on refresh even when locally edited", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as Response);

    const { rerender } = render(<ParishPeopleManager members={baseMembers} />);

    // Alice is "student". Change her role locally to "instructor"
    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[2], { target: { value: "instructor" } });
    expect(selects[2]).toHaveValue("instructor");

    // Now simulate a server refresh that changes Alice to "parish_admin"
    const updated = [
      { clerk_user_id: "user_a", role: "parish_admin" as const, email: "a@test.com", display_name: "Alice" },
      { clerk_user_id: "user_b", role: "instructor" as const, email: "b@test.com", display_name: "Bob" },
    ];

    rerender(<ParishPeopleManager members={updated} />);

    await waitFor(() => {
      const updatedSelects = screen.getAllByRole("combobox");
      // Local edit should be overridden by server data
      expect(updatedSelects[2]).toHaveValue("parish_admin");
    });
  });
});
