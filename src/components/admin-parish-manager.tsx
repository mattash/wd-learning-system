"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import type { DioceseParishRow } from "@/lib/repositories/diocese-admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

interface ParishDraft {
  id: string;
  name: string;
  slug: string;
  allowSelfSignup: boolean;
  archivedAt: string | null;
}

export function AdminParishManager({ parishes }: { parishes: DioceseParishRow[] }) {
  const router = useRouter();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [newAllowSelfSignup, setNewAllowSelfSignup] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "archived">("all");
  const [drafts, setDrafts] = useState<Record<string, ParishDraft>>(
    Object.fromEntries(
      parishes.map((parish) => [
        parish.id,
        {
          id: parish.id,
          name: parish.name,
          slug: parish.slug,
          allowSelfSignup: parish.allow_self_signup,
          archivedAt: parish.archived_at,
        },
      ]),
    ),
  );
  const [message, setMessage] = useState("");

  async function createParish() {
    const response = await fetch("/api/admin/parishes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName, slug: newSlug, allowSelfSignup: newAllowSelfSignup }),
    });

    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error ?? "Failed to create parish.");
      return;
    }

    setMessage("Parish created.");
    setNewName("");
    setNewSlug("");
    setNewAllowSelfSignup(true);
    setShowCreateForm(false);
    router.refresh();
  }

  async function saveParish(id: string) {
    const draft = drafts[id];
    const response = await fetch(`/api/admin/parishes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: draft.name,
        slug: draft.slug,
        allowSelfSignup: draft.allowSelfSignup,
      }),
    });

    const data = await response.json();
    setMessage(response.ok ? "Parish updated." : data.error ?? "Failed to update parish.");
    if (response.ok) router.refresh();
  }

  async function deleteParish(id: string) {
    const response = await fetch(`/api/admin/parishes/${id}`, { method: "DELETE" });
    const data = await response.json();
    setMessage(response.ok ? "Parish deleted." : data.error ?? "Failed to delete parish.");
    if (response.ok) router.refresh();
  }

  async function setArchived(id: string, archive: boolean) {
    const response = await fetch(`/api/admin/parishes/${id}/archive`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archive }),
    });
    const data = await response.json();
    setMessage(response.ok ? (archive ? "Parish archived." : "Parish restored.") : data.error ?? "Failed to update parish archive status.");
    if (response.ok) {
      setDrafts((prev) => ({
        ...prev,
        [id]: {
          ...prev[id],
          archivedAt: archive ? new Date().toISOString() : null,
        },
      }));
      router.refresh();
    }
  }

  const filteredParishes = parishes.filter((parish) => {
    const archivedAt = drafts[parish.id]?.archivedAt ?? parish.archived_at;
    if (statusFilter === "active") return !archivedAt;
    if (statusFilter === "archived") return Boolean(archivedAt);
    return true;
  });

  return (
    <div>
      {/* Inline create form */}
      {showCreateForm && (
        <div className="border-b border-border bg-brand-subtle p-4">
          <div className="mb-3 text-[13px] font-bold">New parish</div>
          <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto_auto]">
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-muted-foreground">Name</label>
              <Input className="h-[34px] text-[13px]" onChange={(e) => setNewName(e.target.value)} placeholder="Parish name" value={newName} />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-muted-foreground">Slug</label>
              <Input className="h-[34px] text-[13px]" onChange={(e) => setNewSlug(e.target.value)} placeholder="parish-slug" value={newSlug} />
            </div>
            <label className="flex items-center gap-2 pb-0.5 text-[13px] cursor-pointer">
              <Checkbox checked={newAllowSelfSignup} onChange={(e) => setNewAllowSelfSignup(e.target.checked)} />
              Self-signup
            </label>
            <div className="flex gap-1.5">
              <Button onClick={createParish} size="sm" type="button">Create</Button>
              <Button onClick={() => setShowCreateForm(false)} size="sm" type="button" variant="ghost">Cancel</Button>
            </div>
          </div>
        </div>
      )}

      {!showCreateForm && (
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <div className="flex items-center gap-2">
            <Select
              className="h-[34px] w-[140px] text-[13px]"
              onChange={(e) => setStatusFilter(e.target.value as "all" | "active" | "archived")}
              value={statusFilter}
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </Select>
          </div>
          <Button onClick={() => setShowCreateForm(true)} size="sm" type="button">+ Add parish</Button>
        </div>
      )}

      {/* Parish table */}
      <table className="w-full text-left">
        <thead>
          <tr>
            <th className="px-3.5 py-2.5 text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground">Parish</th>
            <th className="px-3.5 py-2.5 text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground">Slug</th>
            <th className="px-3.5 py-2.5 text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground">Self-signup</th>
            <th className="px-3.5 py-2.5 text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground">Status</th>
            <th className="px-3.5 py-2.5 text-right text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground">Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredParishes.map((parish) => {
            const draft = drafts[parish.id];
            const isArchived = Boolean(draft?.archivedAt ?? parish.archived_at);
            return (
              <tr className="border-t border-border hover:bg-secondary" key={parish.id}>
                <td className="px-3.5 py-3">
                  <Input
                    className="h-[30px] text-[13px]"
                    onChange={(e) =>
                      setDrafts((prev) => ({ ...prev, [parish.id]: { ...prev[parish.id], name: e.target.value } }))
                    }
                    value={draft?.name ?? parish.name}
                  />
                </td>
                <td className="px-3.5 py-3">
                  <Input
                    className="h-[30px] font-mono text-[12px]"
                    onChange={(e) =>
                      setDrafts((prev) => ({ ...prev, [parish.id]: { ...prev[parish.id], slug: e.target.value } }))
                    }
                    value={draft?.slug ?? parish.slug}
                  />
                </td>
                <td className="px-3.5 py-3">
                  <label className="flex items-center gap-2 text-[13px] cursor-pointer">
                    <Checkbox
                      checked={draft?.allowSelfSignup ?? parish.allow_self_signup}
                      onChange={(e) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [parish.id]: { ...prev[parish.id], allowSelfSignup: e.target.checked },
                        }))
                      }
                    />
                    {(draft?.allowSelfSignup ?? parish.allow_self_signup) ? "Enabled" : "Disabled"}
                  </label>
                </td>
                <td className="px-3.5 py-3">
                  {isArchived ? (
                    <Badge variant="warning">Archived</Badge>
                  ) : (
                    <Badge variant="success">Active</Badge>
                  )}
                </td>
                <td className="px-3.5 py-3 text-right">
                  <div className="flex justify-end gap-1.5">
                    <Button onClick={() => saveParish(parish.id)} size="xs" type="button" variant="secondary">
                      Save
                    </Button>
                    <Button
                      onClick={() => setArchived(parish.id, !isArchived)}
                      size="xs"
                      type="button"
                      variant="ghost"
                    >
                      {isArchived ? "Restore" : "Archive"}
                    </Button>
                    <Button onClick={() => deleteParish(parish.id)} size="xs" type="button" variant="destructive">
                      Delete
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Footer */}
      <div className="flex items-center justify-between rounded-b-lg border-t border-border bg-secondary px-5 py-3">
        <span className="text-xs text-muted-foreground">
          Showing {filteredParishes.length} of {parishes.length} parishes
        </span>
      </div>

      {message ? <p className="px-5 py-3 text-[13px] text-muted-foreground">{message}</p> : null}
    </div>
  );
}
