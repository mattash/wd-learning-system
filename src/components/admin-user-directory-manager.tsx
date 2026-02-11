"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

type ParishRole = "parish_admin" | "instructor" | "student";

interface UserMembership {
  parish_id: string;
  parish_name: string;
  role: ParishRole;
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
  role: "all" | ParishRole;
  dioceseAdmin: "all" | "yes" | "no";
}

interface UserEditDraft {
  displayName: string;
  email: string;
  isDioceseAdmin: boolean;
  memberships: Array<{ parishId: string; role: ParishRole }>;
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
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<UserEditDraft | null>(null);
  const [pendingParishId, setPendingParishId] = useState("");

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

    setUsers((data.users ?? []) as UserDirectoryRow[]);
    setParishes((data.parishes ?? []) as ParishFilterOption[]);
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

  const editingUser = useMemo(
    () => users.find((user) => user.clerk_user_id === editingUserId) ?? null,
    [editingUserId, users],
  );

  const parishNameById = useMemo(() => new Map(parishes.map((parish) => [parish.id, parish.name])), [parishes]);

  const availableParishesForAdd = useMemo(() => {
    if (!editDraft) return [];
    const usedParishIds = new Set(editDraft.memberships.map((membership) => membership.parishId));
    return parishes.filter((parish) => !usedParishIds.has(parish.id));
  }, [editDraft, parishes]);

  async function applyFilters() {
    await loadUsers(filters);
  }

  async function clearFilters() {
    setFilters(defaultFilters);
    await loadUsers(defaultFilters);
  }

  function closeEditor() {
    setEditingUserId(null);
    setEditDraft(null);
    setPendingParishId("");
  }

  function openEditor(user: UserDirectoryRow) {
    setEditingUserId(user.clerk_user_id);
    setEditDraft({
      displayName: user.display_name ?? "",
      email: user.email ?? "",
      isDioceseAdmin: user.is_diocese_admin,
      memberships: user.memberships.map((membership) => ({
        parishId: membership.parish_id,
        role: membership.role,
      })),
    });
    setPendingParishId("");
  }

  function addMembership() {
    if (!pendingParishId || !editDraft) return;

    if (editDraft.memberships.some((membership) => membership.parishId === pendingParishId)) {
      return;
    }

    setEditDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        memberships: [...prev.memberships, { parishId: pendingParishId, role: "student" }],
      };
    });
    setPendingParishId("");
  }

  function removeMembership(parishId: string) {
    setEditDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        memberships: prev.memberships.filter((membership) => membership.parishId !== parishId),
      };
    });
  }

  function setMembershipRole(parishId: string, role: ParishRole) {
    setEditDraft((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        memberships: prev.memberships.map((membership) =>
          membership.parishId === parishId ? { ...membership, role } : membership,
        ),
      };
    });
  }

  async function postAccessUpdate(payload: {
    clerkUserId: string;
    makeDioceseAdmin?: boolean;
    removeDioceseAdmin?: boolean;
    parishId?: string;
    role?: ParishRole;
    removeParishMembership?: boolean;
  }) {
    const response = await fetch("/api/admin/users/access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error ?? "Failed to update user access.");
    }
  }

  async function saveEditorChanges() {
    if (!editingUser || !editDraft) return;

    setSaving(true);
    setMessage("");

    try {
      const clerkUserId = editingUser.clerk_user_id;
      const nextDisplayName = editDraft.displayName.trim() || null;
      const nextEmail = editDraft.email.trim() || null;

      const profileChanged =
        nextDisplayName !== (editingUser.display_name ?? null) ||
        nextEmail !== (editingUser.email ?? null);

      if (profileChanged) {
        const profileResponse = await fetch(`/api/admin/users/${encodeURIComponent(clerkUserId)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            displayName: nextDisplayName,
            email: nextEmail,
          }),
        });

        const profileData = await profileResponse.json();
        if (!profileResponse.ok) {
          throw new Error(profileData.error ?? "Failed to update user profile.");
        }
      }

      if (editDraft.isDioceseAdmin !== editingUser.is_diocese_admin) {
        await postAccessUpdate({
          clerkUserId,
          makeDioceseAdmin: editDraft.isDioceseAdmin,
          removeDioceseAdmin: !editDraft.isDioceseAdmin,
        });
      }

      const originalMemberships = new Map(editingUser.memberships.map((membership) => [membership.parish_id, membership.role]));
      const nextMemberships = new Map(editDraft.memberships.map((membership) => [membership.parishId, membership.role]));

      for (const parishId of originalMemberships.keys()) {
        if (!nextMemberships.has(parishId)) {
          await postAccessUpdate({
            clerkUserId,
            parishId,
            removeParishMembership: true,
          });
        }
      }

      for (const [parishId, role] of nextMemberships.entries()) {
        if (originalMemberships.get(parishId) !== role) {
          await postAccessUpdate({
            clerkUserId,
            parishId,
            role,
          });
        }
      }

      await loadUsers(filters);
      router.refresh();
      closeEditor();
      setMessage("User profile and access updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to update user.");
    } finally {
      setSaving(false);
    }
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
            <th className="py-2 pr-4 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr className="border-t align-top" key={user.clerk_user_id}>
              <td className="py-2 pr-4">{user.display_name ?? "—"}</td>
              <td className="py-2 pr-4">{user.email ?? "—"}</td>
              <td className="py-2 pr-4 font-mono text-xs">{user.clerk_user_id}</td>
              <td className="py-2 pr-4">{user.onboarding_completed_at ? "Yes" : "No"}</td>
              <td className="py-2 pr-4">{user.is_diocese_admin ? "Yes" : "No"}</td>
              <td className="py-2 pr-4">
                {user.memberships.length > 0 ? (
                  <ul className="space-y-1">
                    {user.memberships.map((membership) => (
                      <li key={`${user.clerk_user_id}-${membership.parish_id}`}>
                        {membership.parish_name} ({membership.role})
                      </li>
                    ))}
                  </ul>
                ) : (
                  "—"
                )}
              </td>
              <td className="py-2 pr-4">
                <Button onClick={() => openEditor(user)} size="sm" type="button">
                  Edit profile
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            closeEditor();
          }
        }}
        open={Boolean(editingUser && editDraft)}
      >
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          {editingUser && editDraft ? (
            <>
              <DialogHeader>
                <DialogTitle>Edit profile</DialogTitle>
                <DialogDescription>
                  Update profile details and manage parish memberships for {editingUser.clerk_user_id}.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1 text-sm">
                  <span className="text-muted-foreground">Display name</span>
                  <Input
                    onChange={(e) =>
                      setEditDraft((prev) =>
                        prev
                          ? {
                              ...prev,
                              displayName: e.target.value,
                            }
                          : prev,
                      )
                    }
                    value={editDraft.displayName}
                  />
                </label>

                <label className="grid gap-1 text-sm">
                  <span className="text-muted-foreground">Email</span>
                  <Input
                    onChange={(e) =>
                      setEditDraft((prev) =>
                        prev
                          ? {
                              ...prev,
                              email: e.target.value,
                            }
                          : prev,
                      )
                    }
                    value={editDraft.email}
                  />
                </label>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input
                  checked={editDraft.isDioceseAdmin}
                  className="h-4 w-4"
                  onChange={(e) =>
                    setEditDraft((prev) =>
                      prev
                        ? {
                            ...prev,
                            isDioceseAdmin: e.target.checked,
                          }
                        : prev,
                    )
                  }
                  type="checkbox"
                />
                Diocese admin access
              </label>

              <div className="space-y-3 rounded-md border border-border p-3">
                <div>
                  <h3 className="text-sm font-medium">Parish memberships</h3>
                  <p className="text-xs text-muted-foreground">Set or remove each parish membership and role.</p>
                </div>

                {editDraft.memberships.length > 0 ? (
                  <div className="space-y-2">
                    {editDraft.memberships.map((membership) => (
                      <div className="grid gap-2 rounded-md border border-border p-2 sm:grid-cols-[1fr_auto_auto] sm:items-center" key={membership.parishId}>
                        <div>
                          <p className="font-medium">{parishNameById.get(membership.parishId) ?? membership.parishId}</p>
                          <p className="font-mono text-xs text-muted-foreground">{membership.parishId}</p>
                        </div>
                        <Select
                          onChange={(e) => setMembershipRole(membership.parishId, e.target.value as ParishRole)}
                          value={membership.role}
                        >
                          <option value="student">student</option>
                          <option value="instructor">instructor</option>
                          <option value="parish_admin">parish_admin</option>
                        </Select>
                        <Button onClick={() => removeMembership(membership.parishId)} type="button" variant="ghost">
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No parish memberships assigned.</p>
                )}

                <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                  <Select onChange={(e) => setPendingParishId(e.target.value)} value={pendingParishId}>
                    <option value="">Select parish to add</option>
                    {availableParishesForAdd.map((parish) => (
                      <option key={parish.id} value={parish.id}>
                        {parish.name}
                      </option>
                    ))}
                  </Select>
                  <Button disabled={!pendingParishId} onClick={addMembership} type="button" variant="secondary">
                    Add parish
                  </Button>
                </div>

                {availableParishesForAdd.length === 0 ? (
                  <p className="text-xs text-muted-foreground">All parishes are already assigned to this user.</p>
                ) : null}
              </div>

              <DialogFooter>
                <Button onClick={closeEditor} type="button" variant="ghost">
                  Cancel
                </Button>
                <Button disabled={saving} onClick={() => void saveEditorChanges()} type="button">
                  {saving ? "Saving..." : "Save changes"}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
    </div>
  );
}
