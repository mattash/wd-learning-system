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

const ACTION_DOT_COLORS: Record<string, string> = {
  "course": "bg-primary",
  "enrollment": "bg-success",
  "parish": "bg-success",
  "user_access": "bg-warning",
  "user_profile": "bg-warning",
};

function getDotColor(action: string, resourceType: string): string {
  if (action.includes("delete") || action.includes("remove")) return "bg-destructive";
  return ACTION_DOT_COLORS[resourceType] ?? "bg-primary";
}

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
    <div>
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-5 py-3">
        <Input
          className="h-[34px] w-[200px] text-[13px]"
          onChange={(e) => setFilters((prev) => ({ ...prev, action: e.target.value }))}
          placeholder="Filter logs..."
          value={filters.action}
        />
        <Select
          className="h-[34px] w-[140px] text-[13px]"
          onChange={(e) => setFilters((prev) => ({ ...prev, resourceType: e.target.value }))}
          value={filters.resourceType}
        >
          <option value="">All actions</option>
          <option value="course">Course actions</option>
          <option value="user_profile">User actions</option>
          <option value="parish">Parish actions</option>
          <option value="user_access">Access actions</option>
        </Select>
        <Input className="h-[34px] w-[140px] text-[13px]" onChange={(e) => setFilters((prev) => ({ ...prev, startDate: e.target.value }))} type="date" value={filters.startDate} />
        <Input className="h-[34px] w-[140px] text-[13px]" onChange={(e) => setFilters((prev) => ({ ...prev, endDate: e.target.value }))} type="date" value={filters.endDate} />
        <Button onClick={applyFilters} size="sm" type="button" variant="secondary">
          Apply
        </Button>
        <Button onClick={resetFilters} size="sm" type="button" variant="ghost">
          Reset
        </Button>
      </div>

      {/* Log entries */}
      <div>
        {logs.map((log) => (
          <div className="flex items-start gap-3.5 border-b border-border px-5 py-2.5 text-[13px]" key={log.id}>
            <div className="min-w-[120px] shrink-0 whitespace-nowrap text-xs text-muted-foreground">
              {new Date(log.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              {" · "}
              {new Date(log.created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
            </div>
            <div className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${getDotColor(log.action, log.resource_type)}`} />
            <div className="flex-1">
              <strong>{log.action}:</strong>{" "}
              {log.resource_type}
              {log.resource_id ? ` (${log.resource_id})` : ""}
              {log.details ? (
                <span className="ml-1 text-muted-foreground">
                  {JSON.stringify(log.details).slice(0, 80)}
                  {JSON.stringify(log.details).length > 80 ? "..." : ""}
                </span>
              ) : null}
            </div>
            <div className="shrink-0 text-xs text-primary">{log.actor_clerk_user_id}</div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between rounded-b-lg border-t border-border bg-secondary px-5 py-3">
        <span className="text-xs text-muted-foreground">
          {loading ? "Loading logs..." : `Showing ${logs.length} entries`}
        </span>
      </div>

      {message ? <p className="px-5 py-3 text-[13px] text-muted-foreground">{message}</p> : null}
    </div>
  );
}
