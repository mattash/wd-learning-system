"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

export function AdminMembershipForm() {
  const [clerkUserId, setClerkUserId] = useState("");
  const [parishId, setParishId] = useState("");
  const [role, setRole] = useState("student");
  const [makeDioceseAdmin, setMakeDioceseAdmin] = useState(false);
  const [message, setMessage] = useState("");

  async function submit() {
    const response = await fetch("/api/admin-membership", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clerkUserId, parishId: parishId || undefined, role, makeDioceseAdmin }),
    });

    const data = await response.json();
    setMessage(response.ok ? "Saved" : data.error ?? "Failed");
  }

  return (
    <div className="grid max-w-xl gap-3 rounded border bg-white p-4">
      <input className="rounded border p-2" onChange={(e) => setClerkUserId(e.target.value)} placeholder="clerk_user_id" value={clerkUserId} />
      <input className="rounded border p-2" onChange={(e) => setParishId(e.target.value)} placeholder="parish_id (optional)" value={parishId} />
      <select className="rounded border p-2" onChange={(e) => setRole(e.target.value)} value={role}>
        <option value="student">student</option>
        <option value="instructor">instructor</option>
        <option value="parish_admin">parish_admin</option>
      </select>
      <label className="flex items-center gap-2 text-sm">
        <input checked={makeDioceseAdmin} onChange={(e) => setMakeDioceseAdmin(e.target.checked)} type="checkbox" />
        Make Diocese Admin
      </label>
      <Button onClick={submit} type="button">Save membership</Button>
      {message && <p className="text-sm">{message}</p>}
    </div>
  );
}
