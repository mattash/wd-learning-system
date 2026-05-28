import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AdminUserDirectoryManager } from "@/components/admin-user-directory-manager";

const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

const initialUsers = [
  {
    clerk_user_id: "user-1",
    email: "old@example.com",
    display_name: "Old Name",
    onboarding_completed_at: null,
    created_at: "2026-01-01T00:00:00.000Z",
    is_diocese_admin: false,
    memberships: [],
  },
];

const initialParishes = [
  { id: "parish-1", name: "St. Anne" },
  { id: "parish-2", name: "St. Mark" },
];

function deferredResponse() {
  let resolveResponse!: (response: Response) => void;
  const promise = new Promise<Response>((resolve) => {
    resolveResponse = resolve;
  });

  return {
    promise,
    resolve: resolveResponse,
  };
}

function usersResponse(users: typeof initialUsers): Response {
  return {
    ok: true,
    json: async () => ({ users, parishes: initialParishes }),
  } as Response;
}

describe("AdminUserDirectoryManager", () => {
  beforeEach(() => {
    refresh.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps newer filter results when an older request resolves last", async () => {
    const firstRequest = deferredResponse();
    const secondRequest = deferredResponse();
    const fetchMock = vi
      .fn()
      .mockReturnValueOnce(firstRequest.promise)
      .mockReturnValueOnce(secondRequest.promise);

    vi.stubGlobal("fetch", fetchMock);

    render(
      <AdminUserDirectoryManager
        initialParishes={initialParishes}
        initialUsers={initialUsers}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("Search users..."), {
      target: { value: "first" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    fireEvent.change(screen.getByPlaceholderText("Search users..."), {
      target: { value: "second" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/admin/users?q=first");
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/admin/users?q=second");

    await act(async () => {
      secondRequest.resolve(usersResponse([{ ...initialUsers[0], display_name: "Second Result" }]));
    });

    expect(await screen.findByText("Second Result")).toBeInTheDocument();

    await act(async () => {
      firstRequest.resolve(usersResponse([{ ...initialUsers[0], display_name: "First Result" }]));
    });

    await waitFor(() => expect(screen.queryByText("First Result")).not.toBeInTheDocument());
    expect(screen.getByText("Second Result")).toBeInTheDocument();
  });

  it("reloads user data when access saving fails after a profile update", async () => {
    const reloadedUsers = [
      {
        ...initialUsers[0],
        email: "new@example.com",
        display_name: "New Name",
      },
    ];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url === "/api/admin/users/user-1" && init?.method === "PATCH") {
        return {
          ok: true,
          json: async () => ({ ok: true }),
        } as Response;
      }

      if (url === "/api/admin/users/access" && init?.method === "POST") {
        return {
          ok: false,
          json: async () => ({ error: "Access update failed." }),
        } as Response;
      }

      if (url === "/api/admin/users?") {
        return {
          ok: true,
          json: async () => ({ users: reloadedUsers, parishes: initialParishes }),
        } as Response;
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(
      <AdminUserDirectoryManager
        initialParishes={initialParishes}
        initialUsers={initialUsers}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByDisplayValue("Old Name"), {
      target: { value: "New Name" },
    });
    fireEvent.change(within(dialog).getByDisplayValue("old@example.com"), {
      target: { value: "new@example.com" },
    });
    fireEvent.change(within(dialog).getByDisplayValue("Select parish to add"), {
      target: { value: "parish-2" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add parish" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/admin/users?"));
    expect(refresh).toHaveBeenCalled();
    expect(await screen.findByText("New Name")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "Access update failed. Some changes may have already been saved; the user list has been reloaded.",
      ),
    ).toBeInTheDocument();
  });

  it("reloads user data when a later access update fails after an earlier one succeeds", async () => {
    const userWithMembership = {
      ...initialUsers[0],
      memberships: [
        {
          parish_id: "parish-1",
          parish_name: "St. Anne",
          role: "student" as const,
        },
      ],
    };
    const reloadedUsers = [
      {
        ...userWithMembership,
        memberships: [],
      },
    ];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url === "/api/admin/users/access" && init?.method === "POST") {
        const payload = JSON.parse(String(init.body));
        if (payload.removeParishMembership) {
          return {
            ok: true,
            json: async () => ({ ok: true }),
          } as Response;
        }

        return {
          ok: false,
          json: async () => ({ error: "Access update failed." }),
        } as Response;
      }

      if (url === "/api/admin/users?") {
        return {
          ok: true,
          json: async () => ({ users: reloadedUsers, parishes: initialParishes }),
        } as Response;
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    render(
      <AdminUserDirectoryManager
        initialParishes={initialParishes}
        initialUsers={[userWithMembership]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Remove" }));
    fireEvent.change(within(dialog).getByDisplayValue("Select parish to add"), {
      target: { value: "parish-2" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add parish" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/admin/users?"));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/users/access",
      expect.objectContaining({
        body: JSON.stringify({
          clerkUserId: "user-1",
          parishId: "parish-1",
          removeParishMembership: true,
        }),
      }),
    );
    expect(refresh).toHaveBeenCalled();
    expect(await screen.findByText("None")).toBeInTheDocument();
    expect(screen.getByText("1 users")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "Access update failed. Some changes may have already been saved; the user list has been reloaded.",
      ),
    ).toBeInTheDocument();
  });
});
