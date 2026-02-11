"use client";

import { useState } from "react";

import type { AdminAuditLogRow } from "@/lib/audit-log";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

interface AdminAuditLogViewerProps {
  initialLogs: AdminAuditLogRow[];
}

interface AuditFilters {
  action: string;
  actorUserId: string;
  resourceType: string;
  startDate: string;
  endDate: string;
}

const defaultFilters: AuditFilters = {
  action: "",
  actorUserId: "",
  resourceType: "",
  startDate: "",
  endDate: "",
};

export function AdminAuditLogViewer({ initialLogs }: AdminAuditLogViewerProps) {
  const [logs, setLogs] = useState<AdminAuditLogRow[]>(initialLogs);
  const [filters, setFilters] = useState<AuditFilters>(defaultFilters);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function loadLogs(activeFilters: AuditFilters) {
    setLoading(true);
    setMessage("");

    const params = new URLSearchParams();
    if (activeFilters.action.trim()) params.set("action", activeFilters.action.trim());
    if (activeFilters.actorUserId.trim()) params.set("actorUserId", activeFilters.actorUserId.trim());
    if (activeFilters.resourceType.trim()) params.set("resourceType", activeFilters.resourceType.trim());
    if (activeFilters.startDate) params.set("startDate", activeFilters.startDate);
    if (activeFilters.endDate) params.set("endDate", activeFilters.endDate);

    const response = await fetch(`/api/admin/audit-logs?${params.toString()}`);
    const data = await response.json();
    if (!response.ok) {
      setLoading(false);
      setMessage(data.error ?? "Failed to load audit logs.");
      return;
    }

    setLogs((data.logs ?? []) as AdminAuditLogRow[]);
    setLoading(false);
  }

  async function applyFilters() {
    await loadLogs(filters);
  }

  async function resetFilters() {
    setFilters(defaultFilters);
    await loadLogs(defaultFilters);
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-2 rounded-md border border-border p-3 md:grid-cols-3 lg:grid-cols-6">
        <Input
          onChange={(e) => setFilters((prev) => ({ ...prev, action: e.target.value }))}
          placeholder="Action (ex: parish.updated)"
          value={filters.action}
        />
        <Input
          onChange={(e) => setFilters((prev) => ({ ...prev, actorUserId: e.target.value }))}
          placeholder="Actor Clerk user ID"
          value={filters.actorUserId}
        />
        <Select
          onChange={(e) => setFilters((prev) => ({ ...prev, resourceType: e.target.value }))}
          value={filters.resourceType}
        >
          <option value="">All resources</option>
          <option value="parish">parish</option>
          <option value="user_profile">user_profile</option>
          <option value="user_access">user_access</option>
        </Select>
        <Input onChange={(e) => setFilters((prev) => ({ ...prev, startDate: e.target.value }))} type="date" value={filters.startDate} />
        <Input onChange={(e) => setFilters((prev) => ({ ...prev, endDate: e.target.value }))} type="date" value={filters.endDate} />
        <div className="flex gap-2">
          <Button onClick={applyFilters} type="button" variant="secondary">
            Apply
          </Button>
          <Button onClick={resetFilters} type="button" variant="ghost">
            Reset
          </Button>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">{loading ? "Loading logs..." : `${logs.length} audit events shown`}</p>

      <table className="w-full text-left text-sm">
        <thead className="text-muted-foreground">
          <tr>
            <th className="py-2 pr-4 font-medium">Timestamp</th>
            <th className="py-2 pr-4 font-medium">Actor</th>
            <th className="py-2 pr-4 font-medium">Action</th>
            <th className="py-2 pr-4 font-medium">Resource</th>
            <th className="py-2 pr-4 font-medium">Details</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr className="border-t align-top" key={log.id}>
              <td className="py-2 pr-4">{new Date(log.created_at).toLocaleString()}</td>
              <td className="py-2 pr-4 font-mono text-xs">{log.actor_clerk_user_id}</td>
              <td className="py-2 pr-4">{log.action}</td>
              <td className="py-2 pr-4">
                {log.resource_type}
                {log.resource_id ? ` (${log.resource_id})` : ""}
              </td>
              <td className="py-2 pr-4">
                <pre className="max-w-[28rem] overflow-auto rounded bg-muted p-2 text-xs">
                  {JSON.stringify(log.details ?? {}, null, 2)}
                </pre>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
    </div>
  );
}
