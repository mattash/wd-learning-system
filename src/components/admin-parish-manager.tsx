"use client";

import { useEffect, useRef, useState } from "react";
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

function buildParishDraft(parish: DioceseParishRow): ParishDraft {
  return {
    id: parish.id,
    name: parish.name,
    slug: parish.slug,
    allowSelfSignup: parish.allow_self_signup,
    archivedAt: parish.archived_at,
  };
}

function buildParishDrafts(parishes: DioceseParishRow[]) {
  return Object.fromEntries(parishes.map((parish) => [parish.id, buildParishDraft(parish)])) as Record<string, ParishDraft>;
}

function isSameDraft(left: ParishDraft, right: ParishDraft) {
  return (
    left.name === right.name &&
    left.slug === right.slug &&
    left.allowSelfSignup === right.allowSelfSignup &&
    left.archivedAt === right.archivedAt
  );
}

export function AdminParishManager({ parishes }: { parishes: DioceseParishRow[] }) {
  const router = useRouter();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [newAllowSelfSignup, setNewAllowSelfSignup] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "archived">("all");
  const [drafts, setDrafts] = useState<Record<string, ParishDraft>>(() => buildParishDrafts(parishes));
  const previousPropDrafts = useRef<Record<string, ParishDraft>>(buildParishDrafts(parishes));
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setDrafts((prev) => {
      const next = { ...prev };
      for (const parish of parishes) {
        const propDraft = buildParishDraft(parish);
        const previousPropDraft = previousPropDrafts.current[parish.id];
        if (!next[parish.id] || (previousPropDraft && isSameDraft(next[parish.id], previousPropDraft))) {
          next[parish.id] = propDraft;
        }
      }
      return next;
    });
    previousPropDrafts.current = buildParishDrafts(parishes);
  }, [parishes]);

  async function createParish() {
    setSubmitting(true);
    setMessage("");

    try {
      const response = await fetch("/api/admin/parishes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, slug: newSlug, allowSelfSignup: newAllowSelfSignup }),
      });

      const data = (await response.json().catch(() => ({}))) as { error?: string };

      if (response.ok) {
        setMessage("Parish created.");
        setNewName("");
        setNewSlug("");
        setNewAllowSelfSignup(true);
        setShowCreateForm(false);
        router.refresh();
      } else {
        setMessage(data.error ?? "Failed to create parish.");
      }
    } catch {
      setMessage("Failed to create parish.");
    } finally {
      setSubmitting(false);
    }
  }

  async function saveParish(id: string) {
    const parish = parishes.find((candidate) => candidate.id === id);
    const draft = drafts[id] ?? (parish ? buildParishDraft(parish) : null);
    if (!draft) {
      setMessage("Unable to find parish draft.");
      return;
    }

    setSubmitting(true);
    setMessage("");

    try {
      const response = await fetch(`/api/admin/parishes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: draft.name,
          slug: draft.slug,
          allowSelfSignup: draft.allowSelfSignup,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as { error?: string };

      if (response.ok) {
        setMessage("Parish updated.");
        router.refresh();
      } else {
        setMessage(data.error ?? "Failed to update parish.");
      }
    } catch {
      setMessage("Failed to update parish.");
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteParish(id: string) {
    setSubmitting(true);
    setMessage("");

    try {
      const response = await fetch(`/api/admin/parishes/${id}`, { method: "DELETE" });

      const data = (await response.json().catch(() => ({}))) as { error?: string };

      if (response.ok) {
        setMessage("Parish deleted.");
        router.refresh();
      } else {
        setMessage(data.error ?? "Failed to delete parish.");
      }
    } catch {
      setMessage("Failed to delete parish.");
    } finally {
      setSubmitting(false);
    }
  }

  async function setArchived(id: string, archive: boolean) {
    setSubmitting(true);
    setMessage("");

    try {
      const response = await fetch(`/api/admin/parishes/${id}/archive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archive }),
      });

      const data = (await response.json().catch(() => ({}))) as { error?: string };

      if (response.ok) {
        setMessage(archive ? "Parish archived." : "Parish restored.");
        setDrafts((prev) => ({
          ...prev,
          [id]: {
            ...prev[id],
            archivedAt: archive ? new Date().toISOString() : null,
          },
        }));
        router.refresh();
      } else {
        setMessage(data.error ?? "Failed to update parish archive status.");
      }
    } catch {
      setMessage("Failed to update parish archive status.");
    } finally {
      setSubmitting(false);
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
              <Button disabled={submitting} onClick={createParish} size="sm" type="button">Create</Button>
              <Button disabled={submitting} onClick={() => setShowCreateForm(false)} size="sm" type="button" variant="ghost">Cancel</Button>
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
                    <Button disabled={submitting} onClick={() => saveParish(parish.id)} size="xs" type="button" variant="secondary">
                      Save
                    </Button>
                    <Button
                      disabled={submitting}
                      onClick={() => setArchived(parish.id, !isArchived)}
                      size="xs"
                      type="button"
                      variant="ghost"
                    >
                      {isArchived ? "Restore" : "Archive"}
                    </Button>
                    <Button disabled={submitting} onClick={() => deleteParish(parish.id)} size="xs" type="button" variant="destructive">
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
