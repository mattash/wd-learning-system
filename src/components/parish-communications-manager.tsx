"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type {
  ParishAdminCohortRow,
  ParishAdminCommunicationSendRow,
  ParishAdminCourseRow,
} from "@/lib/repositories/parish-admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

type AudienceType = "all_members" | "stalled_learners" | "cohort" | "course";

function isAudienceType(value: string | null): value is AudienceType {
  return value === "all_members" || value === "stalled_learners" || value === "cohort" || value === "course";
}

function formatAudienceLabel(
  send: ParishAdminCommunicationSendRow,
  cohortNameById: Map<string, string>,
  courseTitleById: Map<string, string>,
) {
  if (send.audience_type === "all_members") return "All members";
  if (send.audience_type === "stalled_learners") return "Stalled learners";
  if (send.audience_type === "cohort") {
    return `Cohort: ${cohortNameById.get(send.audience_value ?? "") ?? send.audience_value ?? "Unknown"}`;
  }
  return `Course: ${courseTitleById.get(send.audience_value ?? "") ?? send.audience_value ?? "Unknown"}`;
}

export function ParishCommunicationsManager({
  cohorts,
  courses,
  sends,
  prefill,
}: {
  cohorts: ParishAdminCohortRow[];
  courses: ParishAdminCourseRow[];
  sends: ParishAdminCommunicationSendRow[];
  prefill?: {
    audienceType?: string | null;
    audienceValue?: string | null;
    subject?: string | null;
    body?: string | null;
  };
}) {
  const router = useRouter();
  const initialAudienceType: AudienceType = isAudienceType(prefill?.audienceType ?? null)
    ? (prefill?.audienceType as AudienceType)
    : "all_members";
  const initialAudienceValue =
    initialAudienceType === "cohort"
      ? cohorts.some((cohort) => cohort.id === prefill?.audienceValue)
        ? (prefill?.audienceValue ?? "")
        : ""
      : initialAudienceType === "course"
        ? courses.some((course) => course.id === prefill?.audienceValue)
          ? (prefill?.audienceValue ?? "")
          : ""
        : "";
  const [audienceType, setAudienceType] = useState<AudienceType>(initialAudienceType);
  const [audienceValue, setAudienceValue] = useState(initialAudienceValue);
  const [subject, setSubject] = useState((prefill?.subject ?? "").slice(0, 160));
  const [body, setBody] = useState((prefill?.body ?? "").slice(0, 5000));
  const [message, setMessage] = useState("");

  const cohortNameById = useMemo(
    () => new Map(cohorts.map((cohort) => [cohort.id, cohort.name])),
    [cohorts],
  );
  const courseTitleById = useMemo(
    () => new Map(courses.map((course) => [course.id, course.title])),
    [courses],
  );

  const needsAudienceValue = audienceType === "cohort" || audienceType === "course";
  const selectedAudienceValue =
    needsAudienceValue && audienceValue
      ? audienceValue
      : needsAudienceValue
        ? (audienceType === "cohort" ? cohorts[0]?.id ?? "" : courses[0]?.id ?? "")
        : "";

  async function logMessage() {
    const response = await fetch("/api/parish-admin/communications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        audienceType,
        audienceValue: needsAudienceValue ? selectedAudienceValue : undefined,
        subject,
        body,
      }),
    });
    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error ?? "Failed to log message.");
      return;
    }

    setMessage(data.deliveryNote ?? "Message logged.");
    setSubject("");
    setBody("");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <p className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
        Delivery is currently log-only. Email/SMS sending is not configured yet.
      </p>

      <div className="grid gap-2 rounded-md border border-border p-3 md:grid-cols-[220px_220px_1fr_auto]">
        <Select onChange={(e) => setAudienceType(e.target.value as AudienceType)} value={audienceType}>
          <option value="all_members">All members</option>
          <option value="stalled_learners">Stalled learners</option>
          <option value="cohort">Specific cohort</option>
          <option value="course">Specific course</option>
        </Select>

        {audienceType === "cohort" ? (
          <Select onChange={(e) => setAudienceValue(e.target.value)} value={selectedAudienceValue}>
            {cohorts.map((cohort) => (
              <option key={cohort.id} value={cohort.id}>
                {cohort.name}
              </option>
            ))}
          </Select>
        ) : audienceType === "course" ? (
          <Select onChange={(e) => setAudienceValue(e.target.value)} value={selectedAudienceValue}>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.title}
              </option>
            ))}
          </Select>
        ) : (
          <div className="rounded-md border border-border px-3 py-2 text-sm text-muted-foreground">
            Audience auto-selected
          </div>
        )}

        <Input maxLength={160} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" value={subject} />

        <Button
          disabled={!subject.trim() || !body.trim() || (needsAudienceValue && !selectedAudienceValue)}
          onClick={logMessage}
          type="button"
        >
          Log message
        </Button>
      </div>

      <textarea
        className="min-h-32 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        maxLength={5000}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Message body"
        value={body}
      />

      <table className="w-full text-left text-sm">
        <thead className="text-muted-foreground">
          <tr>
            <th className="py-2 pr-4 font-medium">When</th>
            <th className="py-2 pr-4 font-medium">Audience</th>
            <th className="py-2 pr-4 font-medium">Subject</th>
            <th className="py-2 pr-4 font-medium">Recipients</th>
            <th className="py-2 pr-4 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {sends.map((send) => (
            <tr className="border-t" key={send.id}>
              <td className="py-2 pr-4">{new Date(send.created_at).toLocaleString()}</td>
              <td className="py-2 pr-4">{formatAudienceLabel(send, cohortNameById, courseTitleById)}</td>
              <td className="py-2 pr-4">{send.subject}</td>
              <td className="py-2 pr-4">{send.recipient_count}</td>
              <td className="py-2 pr-4">{send.delivery_status}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {sends.length === 0 ? (
        <p className="text-sm text-muted-foreground">No communication logs yet.</p>
      ) : null}
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
    </div>
  );
}
