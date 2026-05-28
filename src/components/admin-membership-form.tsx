"use client";

import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

export function AdminMembershipForm() {
  const [clerkUserId, setClerkUserId] = useState("");
  const [parishId, setParishId] = useState("");
  const [role, setRole] = useState("student");
  const [makeDioceseAdmin, setMakeDioceseAdmin] = useState(false);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  async function submit() {
    if (submittingRef.current) {
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);

    try {
      const response = await fetch("/api/admin-membership", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clerkUserId, parishId: parishId || undefined, role, makeDioceseAdmin }),
      });

      const data = await response.json();
      setMessage(response.ok ? "Saved" : data.error ?? "Failed");
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <div className="p-5">
      <div className="grid grid-cols-2 gap-2 mb-3.5">
        <div>
          <label className="mb-1 block text-[11px] font-semibold text-muted-foreground">User</label>
          <Input
            className="h-[34px] text-[13px]"
            onChange={(e) => setClerkUserId(e.target.value)}
            placeholder="clerk_user_id"
            value={clerkUserId}
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-semibold text-muted-foreground">Parish</label>
          <Input
            className="h-[34px] text-[13px]"
            onChange={(e) => setParishId(e.target.value)}
            placeholder="parish_id (optional)"
            value={parishId}
          />
        </div>
      </div>
      <div className="mb-3.5">
        <label className="mb-1 block text-[11px] font-semibold text-muted-foreground">Role</label>
        <Select className="h-[34px] text-[13px]" onChange={(e) => setRole(e.target.value)} value={role}>
          <option value="student">student</option>
          <option value="instructor">instructor</option>
          <option value="parish_admin">parish_admin</option>
        </Select>
      </div>
      <label className="mb-4 flex items-center gap-2.5 text-[13px] cursor-pointer">
        <Checkbox
          checked={makeDioceseAdmin}
          onChange={(e) => setMakeDioceseAdmin(e.target.checked)}
        />
        Make Diocese Admin
      </label>
      <Button aria-busy={submitting} disabled={submitting} onClick={submit} size="sm" type="button">
        {submitting ? "Saving..." : "Add membership"}
      </Button>
      {message && <p className="mt-3 text-[13px] text-muted-foreground">{message}</p>}
    </div>
  );
}
