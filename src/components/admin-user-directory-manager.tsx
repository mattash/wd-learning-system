"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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

  function getUserInitials(user: UserDirectoryRow): string {
    if (user.display_name) {
      return user.display_name
        .split(" ")
        .map((part) => part[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    return (user.email?.[0] ?? "?").toUpperCase();
  }

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-5 py-3">
        <Input
          className="h-[34px] w-[200px] text-[13px]"
          onChange={(e) => setFilters((prev) => ({ ...prev, q: e.target.value }))}
          placeholder="Search users..."
          value={filters.q}
        />
        <Select
          className="h-[34px] w-[140px] text-[13px]"
          onChange={(e) =>
            setFilters((prev) => ({
              ...prev,
              onboarding: e.target.value as UserFilters["onboarding"],
            }))
          }
          value={filters.onboarding}
        >
          <option value="all">All onboarding</option>
          <option value="yes">Onboarded</option>
          <option value="no">Not onboarded</option>
        </Select>
        <Select
          className="h-[34px] w-[140px] text-[13px]"
          onChange={(e) => setFilters((prev) => ({ ...prev, parishId: e.target.value }))}
          value={filters.parishId}
        >
          <option value="all">All parishes</option>
          {parishes.map((parish) => (
            <option key={parish.id} value={parish.id}>
              {parish.name}
            </option>
          ))}
        </Select>
        <Select
          className="h-[34px] w-[140px] text-[13px]"
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
          className="h-[34px] w-[140px] text-[13px]"
          onChange={(e) =>
            setFilters((prev) => ({
              ...prev,
              dioceseAdmin: e.target.value as UserFilters["dioceseAdmin"],
            }))
          }
          value={filters.dioceseAdmin}
        >
          <option value="all">All access</option>
          <option value="yes">Diocese admins</option>
          <option value="no">Non-admins</option>
        </Select>
        <Button onClick={applyFilters} size="sm" type="button" variant="secondary">
          Apply
        </Button>
        <Button onClick={clearFilters} size="sm" type="button" variant="ghost">
          Reset
        </Button>
      </div>

      {/* User table */}
      <table className="w-full text-left">
        <thead>
          <tr>
            <th className="px-3.5 py-2.5 text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground">User</th>
            <th className="px-3.5 py-2.5 text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground">Status</th>
            <th className="px-3.5 py-2.5 text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground">Parishes</th>
            <th className="px-3.5 py-2.5 text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground">Access</th>
            <th className="px-3.5 py-2.5 text-right text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground">Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr className="border-t border-border hover:bg-secondary" key={user.clerk_user_id}>
              <td className="px-3.5 py-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-muted text-[11px] font-bold text-primary">
                    {getUserInitials(user)}
                  </div>
                  <div>
                    <div className="text-[13.5px] font-semibold">{user.display_name ?? "Unnamed"}</div>
                    <div className="text-xs text-muted-foreground">{user.email ?? user.clerk_user_id}</div>
                  </div>
                </div>
              </td>
              <td className="px-3.5 py-3">
                {user.onboarding_completed_at ? (
                  <Badge variant="success">Onboarded</Badge>
                ) : (
                  <Badge variant="warning">Pending</Badge>
                )}
              </td>
              <td className="px-3.5 py-3">
                {user.memberships.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {user.memberships.map((membership) => (
                      <Badge key={`${user.clerk_user_id}-${membership.parish_id}`} variant="parish">
                        {membership.parish_name}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">None</span>
                )}
              </td>
              <td className="px-3.5 py-3">
                <div className="flex flex-wrap gap-1">
                  {user.is_diocese_admin && <Badge variant="role">Diocese Admin</Badge>}
                  {user.memberships.map((membership) => (
                    <Badge key={`${user.clerk_user_id}-${membership.parish_id}-role`} variant="default">
                      {membership.role}
                    </Badge>
                  ))}
                </div>
              </td>
              <td className="px-3.5 py-3 text-right">
                <Button onClick={() => openEditor(user)} size="xs" type="button" variant="secondary">
                  Edit
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Footer */}
      <div className="flex items-center justify-between rounded-b-lg border-t border-border bg-secondary px-5 py-3">
        <span className="text-xs text-muted-foreground">
          {loading ? "Loading users..." : `${users.length} users`}
          {activeFilterCount > 0 ? ` \u00b7 ${activeFilterCount} filters active` : ""}
        </span>
      </div>

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
                <DialogTitle>Edit user</DialogTitle>
                <DialogDescription>
                  Update profile and access for {editingUser.display_name ?? editingUser.clerk_user_id}.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-muted-foreground">Display name</label>
                  <Input
                    className="h-[34px] text-[13px]"
                    onChange={(e) =>
                      setEditDraft((prev) =>
                        prev ? { ...prev, displayName: e.target.value } : prev,
                      )
                    }
                    value={editDraft.displayName}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-muted-foreground">Email</label>
                  <Input
                    className="h-[34px] text-[13px]"
                    onChange={(e) =>
                      setEditDraft((prev) =>
                        prev ? { ...prev, email: e.target.value } : prev,
                      )
                    }
                    value={editDraft.email}
                  />
                </div>
              </div>

              <label className="flex items-center gap-2.5 text-[13px] cursor-pointer">
                <Checkbox
                  checked={editDraft.isDioceseAdmin}
                  onChange={(e) =>
                    setEditDraft((prev) =>
                      prev ? { ...prev, isDioceseAdmin: e.target.checked } : prev,
                    )
                  }
                />
                Diocese admin access
              </label>

              <div className="space-y-3 rounded-md border border-border p-3">
                <div>
                  <h3 className="text-[13px] font-bold">Parish memberships</h3>
                  <p className="text-[11px] text-muted-foreground">Set or remove each parish membership and role.</p>
                </div>

                {editDraft.memberships.length > 0 ? (
                  <div className="space-y-2">
                    {editDraft.memberships.map((membership) => (
                      <div className="grid gap-2 rounded-md border border-border p-2 sm:grid-cols-[1fr_auto_auto] sm:items-center" key={membership.parishId}>
                        <div>
                          <p className="text-[13px] font-semibold">{parishNameById.get(membership.parishId) ?? membership.parishId}</p>
                          <p className="font-mono text-[11px] text-muted-foreground">{membership.parishId}</p>
                        </div>
                        <Select
                          className="h-[30px] text-[12px]"
                          onChange={(e) => setMembershipRole(membership.parishId, e.target.value as ParishRole)}
                          value={membership.role}
                        >
                          <option value="student">student</option>
                          <option value="instructor">instructor</option>
                          <option value="parish_admin">parish_admin</option>
                        </Select>
                        <Button onClick={() => removeMembership(membership.parishId)} size="xs" type="button" variant="destructive-outline">
                          Remove
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[13px] text-muted-foreground">No parish memberships assigned.</p>
                )}

                <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                  <Select className="h-[34px] text-[13px]" onChange={(e) => setPendingParishId(e.target.value)} value={pendingParishId}>
                    <option value="">Select parish to add</option>
                    {availableParishesForAdd.map((parish) => (
                      <option key={parish.id} value={parish.id}>
                        {parish.name}
                      </option>
                    ))}
                  </Select>
                  <Button disabled={!pendingParishId} onClick={addMembership} size="sm" type="button" variant="secondary">
                    Add parish
                  </Button>
                </div>

                {availableParishesForAdd.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground">All parishes are already assigned to this user.</p>
                ) : null}
              </div>

              <DialogFooter>
                <Button onClick={closeEditor} size="sm" type="button" variant="ghost">
                  Cancel
                </Button>
                <Button disabled={saving} onClick={() => void saveEditorChanges()} size="sm" type="button">
                  {saving ? "Saving..." : "Save changes"}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {message ? <p className="px-5 py-3 text-[13px] text-muted-foreground">{message}</p> : null}
    </div>
  );
}
