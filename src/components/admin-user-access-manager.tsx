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

  async function submit() {
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

    const data = await response.json();
    setMessage(response.ok ? "Access updated." : data.error ?? "Failed to update access.");
    if (response.ok) {
      router.refresh();
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
        <Checkbox checked={makeDioceseAdmin} onChange={(e) => setMakeDioceseAdmin(e.target.checked)} />
        Make diocese admin
      </label>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={removeDioceseAdmin} onChange={(e) => setRemoveDioceseAdmin(e.target.checked)} />
        Remove diocese admin
      </label>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox
          checked={removeParishMembership}
          onChange={(e) => setRemoveParishMembership(e.target.checked)}
        />
        Remove parish membership (requires parish_id)
      </label>
      <Button onClick={submit} type="button">
        Apply access update
      </Button>
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
    </div>
  );
}
