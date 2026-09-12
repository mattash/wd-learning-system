import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ParishCommunicationsManager } from "@/components/parish-communications-manager";
import type { ParishAdminCourseRow, ParishAdminEnrollmentRow, ParishAdminMemberRow } from "@/lib/repositories/parish-admin";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const courses = [
  { id: "course-1", title: "Foundations" },
  { id: "course-2", title: "Scripture" },
] as ParishAdminCourseRow[];
const members = [
  { clerk_user_id: "alice", display_name: "Alice Adams", email: "alice@example.com" },
  { clerk_user_id: "bob", display_name: "Bob Brown", email: "bob@example.com" },
  { clerk_user_id: "unenrolled", display_name: "Unenrolled member", email: null },
] as ParishAdminMemberRow[];
const enrollments = [
  { clerk_user_id: "alice", course_id: "course-1", display_name: "Alice Adams", email: "alice@example.com", course_title: "Course One" },
  { clerk_user_id: "alice", course_id: "course-2", display_name: "Alice Adams", email: "alice@example.com", course_title: "Course Two" },
  { clerk_user_id: "bob", course_id: "course-2", display_name: "Bob Brown", email: "bob@example.com", course_title: "Course Two" },
] as ParishAdminEnrollmentRow[];

function setup(rows = enrollments) {
  render(<ParishCommunicationsManager cohorts={[]} courses={courses} sends={[]} members={members} enrollments={rows} />);
  fireEvent.change(screen.getByPlaceholderText("Subject"), { target: { value: "Hello" } });
  fireEvent.change(screen.getByPlaceholderText("Message body"), { target: { value: "Course reminder" } });
}
function openPicker() {
  fireEvent.change(screen.getByRole("combobox", { name: "Recipients" }), { target: { value: "specific_recipients" } });
  return screen.getByRole("dialog", { name: "Choose specific recipients" });
}

describe("specific communication recipients", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ deliveryNote: "Message logged." }) })));
  afterEach(() => vi.unstubAllGlobals());

  it("opens a labeled dialog, focuses search, and lists only distinct enrolled students", () => {
    setup();
    const dialog = openPicker();
    expect(within(dialog).getByLabelText("Search students")).toHaveFocus();
    expect(within(dialog).getAllByRole("checkbox")).toHaveLength(2);
    expect(within(dialog).queryByText("Unenrolled member")).not.toBeInTheDocument();
    expect(within(dialog).getByRole("status")).toHaveTextContent("0 selected · 2 shown");
    expect(within(dialog).getByRole("button", { name: "Confirm recipients" })).toBeDisabled();
  });

  it("filters by name, email and course, retaining selection across filters and sends only confirmed IDs", async () => {
    setup();
    const dialog = openPicker();
    const search = within(dialog).getByLabelText("Search students");
    fireEvent.change(search, { target: { value: "  ALICE  " } });
    fireEvent.click(within(dialog).getByRole("checkbox", { name: /Alice/ }));
    fireEvent.change(search, { target: { value: "bob@example.com" } });
    expect(within(dialog).getAllByRole("checkbox")).toHaveLength(1);
    fireEvent.click(within(dialog).getByRole("checkbox", { name: /Bob/ }));
    fireEvent.change(search, { target: { value: "" } });
    fireEvent.change(within(dialog).getByLabelText("Filter by course"), { target: { value: "course-1" } });
    expect(within(dialog).queryByRole("checkbox", { name: /Bob/ })).not.toBeInTheDocument();
    expect(within(dialog).getByRole("status")).toHaveTextContent("2 selected · 1 shown");
    fireEvent.click(within(dialog).getByRole("checkbox", { name: /Alice/ }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Confirm recipients" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "1 selected · Edit recipients" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Log message" }));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string)).toEqual({
      audienceType: "specific_recipients", recipientIds: ["bob"], subject: "Hello", body: "Course reminder",
    });
  });

  it("discards unconfirmed changes on Escape and Cancel, restores focus, and preserves other modes", async () => {
    setup();
    openPicker();
    fireEvent.click(screen.getByRole("checkbox", { name: /Alice/ }));
    fireEvent.keyDown(screen.getByLabelText("Search students"), { key: "Escape" });
    await waitFor(() => expect(screen.getByRole("button", { name: "0 selected · Edit recipients" })).toHaveFocus());
    expect(screen.getByRole("button", { name: "Log message" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /Edit recipients/ }));
    expect(screen.getByRole("checkbox", { name: /Alice/ })).not.toBeChecked();
    fireEvent.click(screen.getByRole("checkbox", { name: /Bob/ }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm recipients" }));
    fireEvent.click(screen.getByRole("button", { name: /Edit recipients/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Bob/ }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("button", { name: /1 selected/ })).toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox", { name: "Recipients" }), { target: { value: "all_members" } });
    fireEvent.click(screen.getByRole("button", { name: "Log message" }));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    expect(JSON.parse(vi.mocked(fetch).mock.calls[0][1]!.body as string)).toEqual({ audienceType: "all_members", subject: "Hello", body: "Course reminder" });
  });

  it("limits selection to 100 and allows deselecting to make room", () => {
    setup(Array.from({ length: 101 }, (_, i) => ({ clerk_user_id: `student-${i}`, course_id: "course-1" })) as ParishAdminEnrollmentRow[]);
    const dialog = openPicker();
    const checkboxes = within(dialog).getAllByRole("checkbox");
    checkboxes.slice(0, 100).forEach((checkbox) => fireEvent.click(checkbox));
    expect(within(dialog).getByRole("status")).toHaveTextContent("100 selected");
    expect(checkboxes[100]).toBeDisabled();
    expect(checkboxes[0]).toBeEnabled();
    fireEvent.click(checkboxes[0]);
    expect(checkboxes[100]).toBeEnabled();
  });

  it("starts with the current course filter when switching from a course audience", () => {
    setup();
    fireEvent.change(screen.getByRole("combobox", { name: "Recipients" }), { target: { value: "course" } });
    const dialog = openPicker();
    expect(within(dialog).getByLabelText("Filter by course")).toHaveValue("course-1");
    expect(within(dialog).getAllByRole("checkbox")).toHaveLength(1);
    expect(within(dialog).getByRole("checkbox", { name: /Alice/ })).toBeInTheDocument();
  });

  it("shows an empty state when there are no enrollments or no search matches", () => {
    setup([]);
    const dialog = openPicker();
    expect(within(dialog).getByText("No enrolled students match these filters.")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Confirm recipients" })).toBeDisabled();
  });
});
