"use client";

import { useState } from "react";

import type { CourseJoinRequestWithDetails } from "@/lib/repositories/course-join-requests";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type RequestStatus = "PENDING" | "APPROVED" | "REJECTED";

interface ParishJoinRequestsManagerProps {
  initialRequests: CourseJoinRequestWithDetails[];
}

export function ParishJoinRequestsManager({ initialRequests }: ParishJoinRequestsManagerProps) {
  const [requests, setRequests] = useState(initialRequests);
  const [activeTab, setActiveTab] = useState<RequestStatus>("PENDING");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const pending = requests.filter((r) => r.status === "PENDING");
  const approved = requests.filter((r) => r.status === "APPROVED");
  const rejected = requests.filter((r) => r.status === "REJECTED");

  const tabCounts = {
    PENDING: pending.length,
    APPROVED: approved.length,
    REJECTED: rejected.length,
  };

  async function handleApprove(requestId: string) {
    setProcessingId(requestId);
    setMessage(null);
    try {
      const res = await fetch(`/api/parish-admin/course-join-requests/${requestId}/approve`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error ?? "Failed to approve" });
        return;
      }
      // Move the request from pending to approved
      setRequests((prev) =>
        prev.map((r) =>
          r.id === requestId ? { ...r, status: "APPROVED" as const } : r
        )
      );
      setMessage({ type: "success", text: "Enrollment created and request approved." });
    } catch {
      setMessage({ type: "error", text: "Network error — please try again" });
    } finally {
      setProcessingId(null);
    }
  }

  async function handleReject(requestId: string) {
    setProcessingId(requestId);
    setMessage(null);
    try {
      const res = await fetch(`/api/parish-admin/course-join-requests/${requestId}/reject`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error ?? "Failed to reject" });
        return;
      }
      setRequests((prev) =>
        prev.map((r) =>
          r.id === requestId ? { ...r, status: "REJECTED" as const } : r
        )
      );
      setMessage({ type: "success", text: "Request rejected." });
    } catch {
      setMessage({ type: "error", text: "Network error — please try again" });
    } finally {
      setProcessingId(null);
    }
  }

  function RequestRow({
    request,
    showActions = true,
  }: {
    request: CourseJoinRequestWithDetails;
    showActions?: boolean;
  }) {
    const isProcessing = processingId === request.id;
    return (
      <tr className="border-t border-border">
        <td className="py-3 pr-4">
          <div className="flex flex-col">
            <span className="text-sm font-medium">{request.clerkUserId}</span>
            <span className="font-mono text-xs text-muted-foreground">{request.clerkUserId}</span>
          </div>
        </td>
        <td className="py-3 pr-4">
          <span className="text-sm">{request.courseTitle ?? request.courseId}</span>
        </td>
        <td className="py-3 pr-4">
          <span className="text-sm text-muted-foreground">
            {new Date(request.createdAt).toLocaleDateString()}
          </span>
        </td>
        {showActions && request.status === "PENDING" && (
          <td className="py-3 pr-4">
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => handleApprove(request.id)}
                disabled={isProcessing}
                type="button"
              >
                {isProcessing ? "..." : "Approve"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleReject(request.id)}
                disabled={isProcessing}
                type="button"
              >
                {isProcessing ? "..." : "Reject"}
              </Button>
            </div>
          </td>
        )}
      </tr>
    );
  }

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as RequestStatus)}>
        <TabsList>
          <TabsTrigger value="PENDING">
            Pending {tabCounts.PENDING > 0 ? `(${tabCounts.PENDING})` : ""}
          </TabsTrigger>
          <TabsTrigger value="APPROVED">
            Approved {tabCounts.APPROVED > 0 ? `(${tabCounts.APPROVED})` : ""}
          </TabsTrigger>
          <TabsTrigger value="REJECTED">
            Rejected {tabCounts.REJECTED > 0 ? `(${tabCounts.REJECTED})` : ""}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="PENDING" className="mt-4">
          {pending.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No pending requests.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  <th className="pb-2 pr-4 font-medium text-muted-foreground">Student</th>
                  <th className="pb-2 pr-4 font-medium text-muted-foreground">Course</th>
                  <th className="pb-2 pr-4 font-medium text-muted-foreground">Requested</th>
                  <th className="pb-2 pr-4 font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((r) => (
                  <RequestRow key={r.id} request={r} />
                ))}
              </tbody>
            </table>
          )}
        </TabsContent>

        <TabsContent value="APPROVED" className="mt-4">
          {approved.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No approved requests.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  <th className="pb-2 pr-4 font-medium text-muted-foreground">Student</th>
                  <th className="pb-2 pr-4 font-medium text-muted-foreground">Course</th>
                  <th className="pb-2 pr-4 font-medium text-muted-foreground">Approved</th>
                </tr>
              </thead>
              <tbody>
                {approved.map((r) => (
                  <RequestRow key={r.id} request={r} showActions={false} />
                ))}
              </tbody>
            </table>
          )}
        </TabsContent>

        <TabsContent value="REJECTED" className="mt-4">
          {rejected.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">No rejected requests.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  <th className="pb-2 pr-4 font-medium text-muted-foreground">Student</th>
                  <th className="pb-2 pr-4 font-medium text-muted-foreground">Course</th>
                  <th className="pb-2 pr-4 font-medium text-muted-foreground">Rejected</th>
                </tr>
              </thead>
              <tbody>
                {rejected.map((r) => (
                  <RequestRow key={r.id} request={r} showActions={false} />
                ))}
              </tbody>
            </table>
          )}
        </TabsContent>
      </Tabs>

      {message && (
        <p
          className={`text-sm ${
            message.type === "error" ? "text-destructive" : "text-success"
          }`}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}