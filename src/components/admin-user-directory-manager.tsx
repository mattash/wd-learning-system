"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

interface UserMembership {
  parish_id: string;
  parish_name: string;
  role: "parish_admin" | "instructor" | "student";
}

interface UserDirectoryRow {
  clerk_user_id: string;
  email: string | null;
  display_name: string | null;
  onboarding_completed_at: string | null;
  created_at: string;
  is_diocese_admin: boolean;
  memberships: UserMembership[];
}

interface ParishFilterOption {
  id: string;
  name: string;
}

interface UserFilters {
  q: string;
  onboarding: "all" | "yes" | "no";
  parishId: string;
  role: "all" | "parish_admin" | "instructor" | "student";
  dioceseAdmin: "all" | "yes" | "no";
}

interface UserDraft {
  displayName: string;
  email: string;
}

const defaultFilters: UserFilters = {
  q: "",
  onboarding: "all",
  parishId: "all",
  role: "all",
  dioceseAdmin: "all",
};

interface AdminUserDirectoryManagerProps {
  initialUsers: UserDirectoryRow[];
  initialParishes: ParishFilterOption[];
}

export function AdminUserDirectoryManager({
  initialUsers,
  initialParishes,
}: AdminUserDirectoryManagerProps) {
  const router = useRouter();
  const [filters, setFilters] = useState<UserFilters>(defaultFilters);
  const [users, setUsers] = useState<UserDirectoryRow[]>(initialUsers);
  const [parishes, setParishes] = useState<ParishFilterOption[]>(initialParishes);
  const [drafts, setDrafts] = useState<Record<string, UserDraft>>(() =>
    Object.fromEntries(
      initialUsers.map((user) => [
        user.clerk_user_id,
        {
          displayName: user.display_name ?? "",
          email: user.email ?? "",
        },
      ]),
    ),
  );
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const loadUsers = useCallback(async (activeFilters: UserFilters) => {
    setLoading(true);
    setMessage("");

    const params = new URLSearchParams();
    if (activeFilters.q.trim()) params.set("q", activeFilters.q.trim());
    if (activeFilters.onboarding !== "all") params.set("onboarding", activeFilters.onboarding);
    if (activeFilters.parishId !== "all") params.set("parishId", activeFilters.parishId);
    if (activeFilters.role !== "all") params.set("role", activeFilters.role);
    if (activeFilters.dioceseAdmin !== "all") params.set("dioceseAdmin", activeFilters.dioceseAdmin);

    const response = await fetch(`/api/admin/users?${params.toString()}`);
    const data = await response.json();

    if (!response.ok) {
      setLoading(false);
      setMessage(data.error ?? "Failed to load users.");
      return;
    }

    const nextUsers = (data.users ?? []) as UserDirectoryRow[];
    setUsers(nextUsers);
    setParishes((data.parishes ?? []) as ParishFilterOption[]);
    setDrafts(
      Object.fromEntries(
        nextUsers.map((user) => [
          user.clerk_user_id,
          {
            displayName: user.display_name ?? "",
            email: user.email ?? "",
          },
        ]),
      ),
    );
    setLoading(false);
  }, []);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.q.trim()) count += 1;
    if (filters.onboarding !== "all") count += 1;
    if (filters.parishId !== "all") count += 1;
    if (filters.role !== "all") count += 1;
    if (filters.dioceseAdmin !== "all") count += 1;
    return count;
  }, [filters]);

  async function applyFilters() {
    await loadUsers(filters);
  }

  async function clearFilters() {
    setFilters(defaultFilters);
    await loadUsers(defaultFilters);
  }

  async function saveProfile(userId: string) {
    const draft = drafts[userId];
    if (!draft) return;

    const response = await fetch(`/api/admin/users/${encodeURIComponent(userId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        displayName: draft.displayName,
        email: draft.email,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error ?? "Failed to update profile.");
      return;
    }

    setMessage("Profile updated.");
    await loadUsers(filters);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-2 rounded-md border border-border p-3 md:grid-cols-3 lg:grid-cols-6">
        <Input
          onChange={(e) => setFilters((prev) => ({ ...prev, q: e.target.value }))}
          placeholder="Search name, email, or Clerk ID"
          value={filters.q}
        />

        <Select
          onChange={(e) =>
            setFilters((prev) => ({
              ...prev,
              onboarding: e.target.value as UserFilters["onboarding"],
            }))
          }
          value={filters.onboarding}
        >
          <option value="all">All onboarding</option>
          <option value="yes">Onboarded only</option>
          <option value="no">Not onboarded</option>
        </Select>

        <Select onChange={(e) => setFilters((prev) => ({ ...prev, parishId: e.target.value }))} value={filters.parishId}>
          <option value="all">All parishes</option>
          {parishes.map((parish) => (
            <option key={parish.id} value={parish.id}>
              {parish.name}
            </option>
          ))}
        </Select>

        <Select
          onChange={(e) =>
            setFilters((prev) => ({
              ...prev,
              role: e.target.value as UserFilters["role"],
            }))
          }
          value={filters.role}
        >
          <option value="all">All roles</option>
          <option value="parish_admin">Parish admins</option>
          <option value="instructor">Instructors</option>
          <option value="student">Students</option>
        </Select>

        <Select
          onChange={(e) =>
            setFilters((prev) => ({
              ...prev,
              dioceseAdmin: e.target.value as UserFilters["dioceseAdmin"],
            }))
          }
          value={filters.dioceseAdmin}
        >
          <option value="all">All diocesan access</option>
          <option value="yes">Diocese admins only</option>
          <option value="no">Non-diocese admins</option>
        </Select>

        <div className="flex gap-2">
          <Button onClick={applyFilters} type="button" variant="secondary">
            Apply
          </Button>
          <Button onClick={clearFilters} type="button" variant="ghost">
            Reset
          </Button>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        {loading ? "Loading users..." : `${users.length} users shown`}
        {activeFilterCount > 0 ? ` (${activeFilterCount} filters active)` : ""}
      </p>

      <table className="w-full text-left text-sm">
        <thead className="text-muted-foreground">
          <tr>
            <th className="py-2 pr-4 font-medium">Name</th>
            <th className="py-2 pr-4 font-medium">Email</th>
            <th className="py-2 pr-4 font-medium">Clerk user ID</th>
            <th className="py-2 pr-4 font-medium">Onboarded</th>
            <th className="py-2 pr-4 font-medium">Diocese admin</th>
            <th className="py-2 pr-4 font-medium">Parish memberships</th>
            <th className="py-2 pr-4 font-medium">Profile</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr className="border-t align-top" key={user.clerk_user_id}>
              <td className="py-2 pr-4">
                <Input
                  onChange={(e) =>
                    setDrafts((prev) => ({
                      ...prev,
                      [user.clerk_user_id]: {
                        ...prev[user.clerk_user_id],
                        displayName: e.target.value,
                      },
                    }))
                  }
                  value={drafts[user.clerk_user_id]?.displayName ?? ""}
                />
              </td>
              <td className="py-2 pr-4">
                <Input
                  onChange={(e) =>
                    setDrafts((prev) => ({
                      ...prev,
                      [user.clerk_user_id]: {
                        ...prev[user.clerk_user_id],
                        email: e.target.value,
                      },
                    }))
                  }
                  value={drafts[user.clerk_user_id]?.email ?? ""}
                />
              </td>
              <td className="py-2 pr-4 font-mono text-xs">{user.clerk_user_id}</td>
              <td className="py-2 pr-4">{user.onboarding_completed_at ? "Yes" : "No"}</td>
              <td className="py-2 pr-4">{user.is_diocese_admin ? "Yes" : "No"}</td>
              <td className="py-2 pr-4">
                {user.memberships.length > 0 ? (
                  <ul className="space-y-1">
                    {user.memberships.map((membership) => (
                      <li key={`${user.clerk_user_id}-${membership.parish_id}-${membership.role}`}>
                        {membership.parish_name} ({membership.role})
                      </li>
                    ))}
                  </ul>
                ) : (
                  "—"
                )}
              </td>
              <td className="py-2 pr-4">
                <Button onClick={() => void saveProfile(user.clerk_user_id)} size="sm" type="button">
                  Save profile
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
    </div>
  );
}
