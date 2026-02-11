"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

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
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle className="text-base">Membership Assignment</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        <Input
          onChange={(e) => setClerkUserId(e.target.value)}
          placeholder="clerk_user_id"
          value={clerkUserId}
        />
        <Input
          onChange={(e) => setParishId(e.target.value)}
          placeholder="parish_id (optional)"
          value={parishId}
        />
        <Select onChange={(e) => setRole(e.target.value)} value={role}>
          <option value="student">student</option>
          <option value="instructor">instructor</option>
          <option value="parish_admin">parish_admin</option>
        </Select>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={makeDioceseAdmin}
            onChange={(e) => setMakeDioceseAdmin(e.target.checked)}
          />
          Make Diocese Admin
        </label>
        <Button onClick={submit} type="button">
          Save membership
        </Button>
        {message && <p className="text-sm text-muted-foreground">{message}</p>}
      </CardContent>
    </Card>
  );
}
