"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type { ParishAdminMemberRow } from "@/lib/repositories/parish-admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

interface ImportResultRow {
  row: number;
  identifier: string;
  role: "parish_admin" | "instructor" | "student";
  status: "imported" | "skipped";
  message: string;
}

interface MemberDraft {
  role: "parish_admin" | "instructor" | "student";
}

function getMemberLabel(member: ParishAdminMemberRow) {
  return member.display_name ?? member.email ?? member.clerk_user_id;
}

export function ParishPeopleManager({ members }: { members: ParishAdminMemberRow[] }) {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [newRole, setNewRole] = useState<"parish_admin" | "instructor" | "student">("student");
  const [search, setSearch] = useState("");
  const [importCsvText, setImportCsvText] = useState("email,role");
  const [importDefaultRole, setImportDefaultRole] = useState<"parish_admin" | "instructor" | "student">("student");
  const [importResults, setImportResults] = useState<ImportResultRow[]>([]);
  const [message, setMessage] = useState("");
  const [drafts, setDrafts] = useState<Record<string, MemberDraft>>(
    Object.fromEntries(
      members.map((member) => [
        member.clerk_user_id,
        {
          role: member.role,
        },
      ]),
    ),
  );

  const filteredMembers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) return members;

    return members.filter((member) => {
      return (
        member.clerk_user_id.toLowerCase().includes(normalizedSearch) ||
        (member.display_name ?? "").toLowerCase().includes(normalizedSearch) ||
        (member.email ?? "").toLowerCase().includes(normalizedSearch) ||
        member.role.toLowerCase().includes(normalizedSearch)
      );
    });
  }, [members, search]);

  async function addMember() {
    const response = await fetch("/api/parish-admin/people", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifier,
        role: newRole,
      }),
    });

    const data = await response.json();
    setMessage(response.ok ? "Member added." : data.error ?? "Failed to add member.");
    if (!response.ok) return;

    setIdentifier("");
    router.refresh();
  }

  async function updateRole(clerkUserId: string) {
    const draft = drafts[clerkUserId];
    if (!draft) return;

    const response = await fetch(`/api/parish-admin/people/${encodeURIComponent(clerkUserId)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        role: draft.role,
      }),
    });
    const data = await response.json();
    setMessage(response.ok ? "Role updated." : data.error ?? "Failed to update role.");
    if (response.ok) {
      router.refresh();
    }
  }

  async function removeMember(clerkUserId: string) {
    const response = await fetch(`/api/parish-admin/people/${encodeURIComponent(clerkUserId)}`, {
      method: "DELETE",
    });
    const data = await response.json();
    setMessage(response.ok ? "Member removed." : data.error ?? "Failed to remove member.");
    if (response.ok) {
      router.refresh();
    }
  }

  async function importMembers() {
    const response = await fetch("/api/parish-admin/people", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        csvText: importCsvText,
        defaultRole: importDefaultRole,
      }),
    });
    const data = await response.json();
    setMessage(response.ok ? `Import finished: ${data.summary.importedCount} imported, ${data.summary.skippedCount} skipped.` : data.error ?? "Failed to import members.");
    setImportResults((data.results ?? []) as ImportResultRow[]);
    if (response.ok) {
      router.refresh();
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-2 rounded-md border border-border p-3 md:grid-cols-[1.2fr_1fr_auto]">
        <Input
          onChange={(e) => setIdentifier(e.target.value)}
          placeholder="Email or clerk_user_id"
          value={identifier}
        />
        <Select onChange={(e) => setNewRole(e.target.value as "parish_admin" | "instructor" | "student")} value={newRole}>
          <option value="student">student</option>
          <option value="instructor">instructor</option>
          <option value="parish_admin">parish_admin</option>
        </Select>
        <Button disabled={!identifier.trim()} onClick={addMember} type="button">
          Add member
        </Button>
      </div>

      <div className="grid gap-2 rounded-md border border-border p-3">
        <div className="grid gap-2 md:grid-cols-[1fr_220px_auto]">
          <Select
            onChange={(e) => setImportDefaultRole(e.target.value as "parish_admin" | "instructor" | "student")}
            value={importDefaultRole}
          >
            <option value="student">Default role: student</option>
            <option value="instructor">Default role: instructor</option>
            <option value="parish_admin">Default role: parish_admin</option>
          </Select>
          <Button onClick={importMembers} type="button" variant="secondary">
            Import CSV
          </Button>
        </div>
        <textarea
          className="min-h-28 rounded-md border border-input bg-background px-3 py-2 font-mono text-xs"
          onChange={(e) => setImportCsvText(e.target.value)}
          placeholder={"email,role\nperson@example.com,student\nanother@example.com,instructor"}
          value={importCsvText}
        />
        <p className="text-xs text-muted-foreground">
          Required headers: <span className="font-mono">email</span> or <span className="font-mono">clerk_user_id</span>. Optional: <span className="font-mono">role</span>.
        </p>
      </div>

      <div className="flex items-center justify-between gap-2">
        <Input
          className="max-w-sm"
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search members by name, email, role, or ID"
          value={search}
        />
        <p className="text-sm text-muted-foreground">{filteredMembers.length} members</p>
      </div>

      <table className="w-full text-left text-sm">
        <thead className="text-muted-foreground">
          <tr>
            <th className="py-2 pr-4 font-medium">Name</th>
            <th className="py-2 pr-4 font-medium">Email</th>
            <th className="py-2 pr-4 font-medium">Clerk user ID</th>
            <th className="py-2 pr-4 font-medium">Role</th>
            <th className="py-2 pr-4 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredMembers.map((member) => (
            <tr className="border-t" key={member.clerk_user_id}>
              <td className="py-2 pr-4">{getMemberLabel(member)}</td>
              <td className="py-2 pr-4">{member.email ?? "—"}</td>
              <td className="py-2 pr-4 font-mono text-xs">{member.clerk_user_id}</td>
              <td className="py-2 pr-4">
                <Select
                  onChange={(e) =>
                    setDrafts((prev) => ({
                      ...prev,
                      [member.clerk_user_id]: {
                        role: e.target.value as "parish_admin" | "instructor" | "student",
                      },
                    }))
                  }
                  value={drafts[member.clerk_user_id]?.role ?? member.role}
                >
                  <option value="student">student</option>
                  <option value="instructor">instructor</option>
                  <option value="parish_admin">parish_admin</option>
                </Select>
              </td>
              <td className="py-2 pr-4">
                <div className="flex gap-2">
                  <Button onClick={() => updateRole(member.clerk_user_id)} size="sm" type="button" variant="secondary">
                    Save role
                  </Button>
                  <Button onClick={() => removeMember(member.clerk_user_id)} size="sm" type="button" variant="destructive">
                    Remove
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {importResults.length > 0 ? (
        <div className="rounded-md border border-border p-3">
          <h3 className="text-sm font-medium">Import results</h3>
          <table className="mt-2 w-full text-left text-xs">
            <thead className="text-muted-foreground">
              <tr>
                <th className="py-1 pr-3 font-medium">Row</th>
                <th className="py-1 pr-3 font-medium">Identifier</th>
                <th className="py-1 pr-3 font-medium">Role</th>
                <th className="py-1 pr-3 font-medium">Status</th>
                <th className="py-1 pr-3 font-medium">Message</th>
              </tr>
            </thead>
            <tbody>
              {importResults.map((result) => (
                <tr className="border-t" key={`${result.row}-${result.identifier}-${result.status}`}>
                  <td className="py-1 pr-3">{result.row}</td>
                  <td className="py-1 pr-3 font-mono">{result.identifier || "—"}</td>
                  <td className="py-1 pr-3">{result.role}</td>
                  <td className="py-1 pr-3">{result.status}</td>
                  <td className="py-1 pr-3 text-muted-foreground">{result.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
    </div>
  );
}
