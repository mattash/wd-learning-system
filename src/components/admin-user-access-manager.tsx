"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

export function AdminUserAccessManager() {
  const router = useRouter();
  const [clerkUserId, setClerkUserId] = useState("");
  const [parishId, setParishId] = useState("");
  const [role, setRole] = useState("student");
  const [makeDioceseAdmin, setMakeDioceseAdmin] = useState(false);
  const [removeDioceseAdmin, setRemoveDioceseAdmin] = useState(false);
  const [removeParishMembership, setRemoveParishMembership] = useState(false);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function handleMakeDioceseAdmin(checked: boolean) {
    setMakeDioceseAdmin(checked);
    if (checked) setRemoveDioceseAdmin(false);
  }

  function handleRemoveDioceseAdmin(checked: boolean) {
    setRemoveDioceseAdmin(checked);
    if (checked) setMakeDioceseAdmin(false);
  }

  async function submit() {
    if (submitting) return;

    if (makeDioceseAdmin && removeDioceseAdmin) {
      setMessage("Cannot both make and remove diocese admin at the same time.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/admin/users/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clerkUserId,
          parishId: parishId || undefined,
          role,
          makeDioceseAdmin,
          removeDioceseAdmin,
          removeParishMembership,
        }),
      });

      if (!response.ok) {
        let data: { error?: string } = {};
        try {
          data = await response.json();
        } catch {
          data = {};
        }
        setMessage(data.error ?? "Failed to update access.");
        return;
      }

      setMessage("Access updated.");
      router.refresh();
    } catch {
      setMessage("Failed to update access.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-3 rounded-md border border-border p-3">
      <Input onChange={(e) => setClerkUserId(e.target.value)} placeholder="clerk_user_id" value={clerkUserId} />
      <Input onChange={(e) => setParishId(e.target.value)} placeholder="parish_id (optional)" value={parishId} />
      <Select onChange={(e) => setRole(e.target.value)} value={role}>
        <option value="student">student</option>
        <option value="instructor">instructor</option>
        <option value="parish_admin">parish_admin</option>
      </Select>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={makeDioceseAdmin} onChange={(e) => handleMakeDioceseAdmin(e.target.checked)} />
        Make diocese admin
      </label>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={removeDioceseAdmin} onChange={(e) => handleRemoveDioceseAdmin(e.target.checked)} />
        Remove diocese admin
      </label>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox
          checked={removeParishMembership}
          onChange={(e) => setRemoveParishMembership(e.target.checked)}
        />
        Remove parish membership (requires parish_id)
      </label>
      <Button disabled={submitting} onClick={submit} type="button">
        {submitting ? "Submitting..." : "Apply access update"}
      </Button>
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
    </div>
  );
}
