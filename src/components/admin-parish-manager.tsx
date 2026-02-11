"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import type { DioceseParishRow } from "@/lib/repositories/diocese-admin";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

interface ParishDraft {
  id: string;
  name: string;
  slug: string;
  allowSelfSignup: boolean;
}

export function AdminParishManager({ parishes }: { parishes: DioceseParishRow[] }) {
  const router = useRouter();
  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [newAllowSelfSignup, setNewAllowSelfSignup] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, ParishDraft>>(
    Object.fromEntries(
      parishes.map((parish) => [
        parish.id,
        {
          id: parish.id,
          name: parish.name,
          slug: parish.slug,
          allowSelfSignup: parish.allow_self_signup,
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

  return (
    <div className="space-y-4">
      <div className="grid gap-2 rounded-md border border-border p-3 md:grid-cols-4">
        <Input onChange={(e) => setNewName(e.target.value)} placeholder="New parish name" value={newName} />
        <Input onChange={(e) => setNewSlug(e.target.value)} placeholder="new-parish-slug" value={newSlug} />
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={newAllowSelfSignup} onChange={(e) => setNewAllowSelfSignup(e.target.checked)} />
          Allow self-signup
        </label>
        <Button onClick={createParish} type="button">
          Create parish
        </Button>
      </div>

      <table className="w-full text-left text-sm">
        <thead className="text-muted-foreground">
          <tr>
            <th className="py-2 pr-4 font-medium">Parish</th>
            <th className="py-2 pr-4 font-medium">Slug</th>
            <th className="py-2 pr-4 font-medium">Self-signup</th>
            <th className="py-2 pr-4 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {parishes.map((parish) => {
            const draft = drafts[parish.id];
            return (
              <tr className="border-t" key={parish.id}>
                <td className="py-2 pr-4">
                  <Input
                    onChange={(e) =>
                      setDrafts((prev) => ({ ...prev, [parish.id]: { ...prev[parish.id], name: e.target.value } }))
                    }
                    value={draft?.name ?? parish.name}
                  />
                </td>
                <td className="py-2 pr-4">
                  <Input
                    onChange={(e) =>
                      setDrafts((prev) => ({ ...prev, [parish.id]: { ...prev[parish.id], slug: e.target.value } }))
                    }
                    value={draft?.slug ?? parish.slug}
                  />
                </td>
                <td className="py-2 pr-4">
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={draft?.allowSelfSignup ?? parish.allow_self_signup}
                      onChange={(e) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [parish.id]: { ...prev[parish.id], allowSelfSignup: e.target.checked },
                        }))
                      }
                    />
                    Enabled
                  </label>
                </td>
                <td className="py-2 pr-4">
                  <div className="flex gap-2">
                    <Button onClick={() => saveParish(parish.id)} size="sm" type="button" variant="secondary">
                      Save
                    </Button>
                    <Button onClick={() => deleteParish(parish.id)} size="sm" type="button" variant="destructive">
                      Delete
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
    </div>
  );
}
