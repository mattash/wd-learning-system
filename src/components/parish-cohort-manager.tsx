"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type {
  ParishAdminCohortRow,
  ParishAdminCourseRow,
  ParishAdminEnrollmentRow,
  ParishAdminMemberRow,
} from "@/lib/repositories/parish-admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

type CohortCadence = ParishAdminCohortRow["cadence"];

interface CohortDraft {
  id: string;
  name: string;
  facilitatorClerkUserId: string;
  cadence: CohortCadence;
  nextSessionAt: string;
}

function toDateTimeLocalValue(dateValue: string | null) {
  if (!dateValue) return "";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "";
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 16);
}

function toIsoDateTimeOrNull(dateValue: string) {
  if (!dateValue) return null;
  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function getMemberLabel(member: ParishAdminMemberRow) {
  const base = member.display_name ?? member.email ?? member.clerk_user_id;
  return `${base} (${member.role})`;
}

export function ParishCohortManager({
  canManageAll,
  cohorts,
  members,
  enrollments,
  courses,
}: {
  canManageAll: boolean;
  cohorts: ParishAdminCohortRow[];
  members: ParishAdminMemberRow[];
  enrollments: ParishAdminEnrollmentRow[];
  courses: ParishAdminCourseRow[];
}) {
  const router = useRouter();
  const [newName, setNewName] = useState("");
  const [newFacilitatorId, setNewFacilitatorId] = useState("");
  const [newCadence, setNewCadence] = useState<CohortCadence>("weekly");
  const [newNextSessionAt, setNewNextSessionAt] = useState("");
  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState(enrollments[0]?.id ?? "");
  const [selectedAssignmentCohortId, setSelectedAssignmentCohortId] = useState("");
  const [message, setMessage] = useState("");
  const [drafts, setDrafts] = useState<Record<string, CohortDraft>>(
    Object.fromEntries(
      cohorts.map((cohort) => [
        cohort.id,
        {
          id: cohort.id,
          name: cohort.name,
          facilitatorClerkUserId: cohort.facilitator_clerk_user_id ?? "",
          cadence: cohort.cadence,
          nextSessionAt: toDateTimeLocalValue(cohort.next_session_at),
        },
      ]),
    ),
  );

  const memberById = useMemo(
    () => new Map(members.map((member) => [member.clerk_user_id, member])),
    [members],
  );
  const courseById = useMemo(() => new Map(courses.map((course) => [course.id, course])), [courses]);
  const cohortById = useMemo(() => new Map(cohorts.map((cohort) => [cohort.id, cohort])), [cohorts]);
  const enrollmentCountByCohort = useMemo(() => {
    const counts = new Map<string, number>();
    enrollments.forEach((enrollment) => {
      if (!enrollment.cohort_id) return;
      counts.set(enrollment.cohort_id, (counts.get(enrollment.cohort_id) ?? 0) + 1);
    });
    return counts;
  }, [enrollments]);

  const selectedEnrollmentIdValue = enrollments.some((enrollment) => enrollment.id === selectedEnrollmentId)
    ? selectedEnrollmentId
    : (enrollments[0]?.id ?? "");
  const selectedEnrollment = enrollments.find((enrollment) => enrollment.id === selectedEnrollmentIdValue) ?? null;
  const selectedAssignmentCohortIdValue =
    selectedAssignmentCohortId === "" || cohorts.some((cohort) => cohort.id === selectedAssignmentCohortId)
      ? selectedAssignmentCohortId
      : (selectedEnrollment?.cohort_id ?? "");

  async function createCohort() {
    const response = await fetch("/api/parish-admin/cohorts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newName,
        facilitatorClerkUserId: newFacilitatorId || null,
        cadence: newCadence,
        nextSessionAt: toIsoDateTimeOrNull(newNextSessionAt),
      }),
    });
    const data = await response.json();
    setMessage(response.ok ? "Cohort created." : data.error ?? "Failed to create cohort.");
    if (!response.ok) return;

    setNewName("");
    setNewFacilitatorId("");
    setNewCadence("weekly");
    setNewNextSessionAt("");
    router.refresh();
  }

  async function saveCohort(cohortId: string) {
    const draft = drafts[cohortId];
    if (!draft) return;

    const response = await fetch(`/api/parish-admin/cohorts/${cohortId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: draft.name,
        facilitatorClerkUserId: draft.facilitatorClerkUserId || null,
        cadence: draft.cadence,
        nextSessionAt: toIsoDateTimeOrNull(draft.nextSessionAt),
      }),
    });
    const data = await response.json();
    setMessage(response.ok ? "Cohort updated." : data.error ?? "Failed to update cohort.");
    if (response.ok) {
      router.refresh();
    }
  }

  async function deleteCohort(cohortId: string) {
    const response = await fetch(`/api/parish-admin/cohorts/${cohortId}`, {
      method: "DELETE",
    });
    const data = await response.json();
    setMessage(response.ok ? "Cohort deleted." : data.error ?? "Failed to delete cohort.");
    if (response.ok) {
      router.refresh();
    }
  }

  async function assignEnrollmentToCohort() {
    if (!selectedEnrollmentIdValue) return;
    const response = await fetch("/api/parish-admin/cohort-assignments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        enrollmentId: selectedEnrollmentIdValue,
        cohortId: selectedAssignmentCohortIdValue || null,
      }),
    });
    const data = await response.json();
    setMessage(response.ok ? "Enrollment assignment updated." : data.error ?? "Failed to assign enrollment.");
    if (response.ok) {
      router.refresh();
    }
  }

  return (
    <div className="space-y-4">
      {canManageAll ? (
        <div className="grid gap-2 rounded-md border border-border p-3 md:grid-cols-[1.2fr_1fr_1fr_1fr_auto]">
          <Input onChange={(e) => setNewName(e.target.value)} placeholder="Cohort name" value={newName} />

          <Select onChange={(e) => setNewFacilitatorId(e.target.value)} value={newFacilitatorId}>
            <option value="">No facilitator assigned</option>
            {members.map((member) => (
              <option key={member.clerk_user_id} value={member.clerk_user_id}>
                {getMemberLabel(member)}
              </option>
            ))}
          </Select>

          <Select onChange={(e) => setNewCadence(e.target.value as CohortCadence)} value={newCadence}>
            <option value="weekly">Weekly</option>
            <option value="biweekly">Biweekly</option>
            <option value="monthly">Monthly</option>
            <option value="custom">Custom</option>
          </Select>

          <Input
            onChange={(e) => setNewNextSessionAt(e.target.value)}
            placeholder="Next session"
            type="datetime-local"
            value={newNextSessionAt}
          />

          <Button disabled={!newName.trim()} onClick={createCohort} type="button">
            Create cohort
          </Button>
        </div>
      ) : null}

      {canManageAll ? (
        <div className="grid gap-2 rounded-md border border-border p-3 md:grid-cols-[1.4fr_1.2fr_1fr_1fr_auto]">
          <Select onChange={(e) => setSelectedEnrollmentId(e.target.value)} value={selectedEnrollmentIdValue}>
            {enrollments.length > 0 ? (
              enrollments.map((enrollment) => {
                const member = memberById.get(enrollment.clerk_user_id);
                const course = courseById.get(enrollment.course_id);
                const assignedCohort = enrollment.cohort_id ? cohortById.get(enrollment.cohort_id) : null;
                return (
                  <option key={enrollment.id} value={enrollment.id}>
                    {(member ? getMemberLabel(member) : enrollment.clerk_user_id) +
                      " - " +
                      (course?.title ?? enrollment.course_id) +
                      (assignedCohort ? ` (${assignedCohort.name})` : " (Unassigned)")}
                  </option>
                );
              })
            ) : (
              <option value="">No enrollments available</option>
            )}
          </Select>

          <Select onChange={(e) => setSelectedAssignmentCohortId(e.target.value)} value={selectedAssignmentCohortIdValue}>
            <option value="">Unassigned</option>
            {cohorts.map((cohort) => (
              <option key={cohort.id} value={cohort.id}>
                {cohort.name}
              </option>
            ))}
          </Select>

          <div className="rounded-md border border-border px-3 py-2 text-sm text-muted-foreground">
            Current:{" "}
            {selectedEnrollment?.cohort_id
              ? (cohortById.get(selectedEnrollment.cohort_id)?.name ?? "Unknown")
              : "Unassigned"}
          </div>

          <div className="rounded-md border border-border px-3 py-2 text-sm text-muted-foreground">
            Enrollments: {enrollments.length}
          </div>

          <Button
            disabled={!selectedEnrollmentIdValue}
            onClick={assignEnrollmentToCohort}
            type="button"
            variant="secondary"
          >
            Update assignment
          </Button>
        </div>
      ) : null}

      {cohorts.length > 0 ? (
        <table className="w-full text-left text-sm">
          <thead className="text-muted-foreground">
            <tr>
              <th className="py-2 pr-4 font-medium">Name</th>
              <th className="py-2 pr-4 font-medium">Facilitator</th>
              <th className="py-2 pr-4 font-medium">Cadence</th>
              <th className="py-2 pr-4 font-medium">Next session</th>
              <th className="py-2 pr-4 font-medium">Members</th>
              <th className="py-2 pr-4 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {cohorts.map((cohort) => {
              const draft = drafts[cohort.id];
              const facilitator = cohort.facilitator_clerk_user_id
                ? memberById.get(cohort.facilitator_clerk_user_id)
                : null;
              return (
                <tr className="border-t" key={cohort.id}>
                  <td className="py-2 pr-4">
                    <Input
                      onChange={(e) =>
                        setDrafts((prev) => ({ ...prev, [cohort.id]: { ...prev[cohort.id], name: e.target.value } }))
                      }
                      value={draft?.name ?? cohort.name}
                    />
                  </td>
                  <td className="py-2 pr-4">
                    {canManageAll ? (
                      <Select
                        onChange={(e) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [cohort.id]: { ...prev[cohort.id], facilitatorClerkUserId: e.target.value },
                          }))
                        }
                        value={draft?.facilitatorClerkUserId ?? cohort.facilitator_clerk_user_id ?? ""}
                      >
                        <option value="">No facilitator assigned</option>
                        {members.map((member) => (
                          <option key={member.clerk_user_id} value={member.clerk_user_id}>
                            {getMemberLabel(member)}
                          </option>
                        ))}
                      </Select>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        {facilitator ? getMemberLabel(facilitator) : "No facilitator assigned"}
                      </p>
                    )}
                  </td>
                  <td className="py-2 pr-4">
                    <Select
                      onChange={(e) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [cohort.id]: { ...prev[cohort.id], cadence: e.target.value as CohortCadence },
                        }))
                      }
                      value={draft?.cadence ?? cohort.cadence}
                    >
                      <option value="weekly">Weekly</option>
                      <option value="biweekly">Biweekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="custom">Custom</option>
                    </Select>
                  </td>
                  <td className="py-2 pr-4">
                    <Input
                      onChange={(e) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [cohort.id]: { ...prev[cohort.id], nextSessionAt: e.target.value },
                        }))
                      }
                      type="datetime-local"
                      value={draft?.nextSessionAt ?? toDateTimeLocalValue(cohort.next_session_at)}
                    />
                  </td>
                  <td className="py-2 pr-4">{enrollmentCountByCohort.get(cohort.id) ?? 0}</td>
                  <td className="py-2 pr-4">
                    <div className="flex gap-2">
                      <Button onClick={() => saveCohort(cohort.id)} size="sm" type="button" variant="secondary">
                        Save
                      </Button>
                      {canManageAll ? (
                        <Button onClick={() => deleteCohort(cohort.id)} size="sm" type="button" variant="destructive">
                          Delete
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <p className="text-sm text-muted-foreground">No cohorts created yet.</p>
      )}

      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
    </div>
  );
}
