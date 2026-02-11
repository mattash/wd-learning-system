"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type {
  ParishAdminCourseRow,
  ParishAdminEnrollmentRow,
  ParishAdminMemberRow,
} from "@/lib/repositories/parish-admin";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";

function getMemberLabel(member: ParishAdminMemberRow) {
  const base = member.display_name ?? member.email ?? member.clerk_user_id;
  return `${base} (${member.role})`;
}

export function ParishEnrollmentManager({
  members,
  courses,
  enrollments,
}: {
  members: ParishAdminMemberRow[];
  courses: ParishAdminCourseRow[];
  enrollments: ParishAdminEnrollmentRow[];
}) {
  const router = useRouter();
  const [selectedUserId, setSelectedUserId] = useState(members[0]?.clerk_user_id ?? "");
  const [selectedCourseId, setSelectedCourseId] = useState(courses[0]?.id ?? "");
  const [message, setMessage] = useState("");

  const memberById = useMemo(
    () => new Map(members.map((member) => [member.clerk_user_id, member])),
    [members],
  );
  const courseById = useMemo(() => new Map(courses.map((course) => [course.id, course])), [courses]);
  const selectedUserIdValue = members.some((member) => member.clerk_user_id === selectedUserId)
    ? selectedUserId
    : (members[0]?.clerk_user_id ?? "");
  const selectedCourseIdValue = courses.some((course) => course.id === selectedCourseId)
    ? selectedCourseId
    : (courses[0]?.id ?? "");

  async function addEnrollment() {
    if (!selectedUserIdValue || !selectedCourseIdValue) return;

    const response = await fetch("/api/parish-admin/enrollments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clerkUserId: selectedUserIdValue, courseId: selectedCourseIdValue }),
    });
    const data = await response.json();
    setMessage(response.ok ? "Enrollment saved." : data.error ?? "Failed to save enrollment.");
    if (response.ok) {
      router.refresh();
    }
  }

  async function removeEnrollment(item: ParishAdminEnrollmentRow) {
    const response = await fetch("/api/parish-admin/enrollments", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clerkUserId: item.clerk_user_id,
        courseId: item.course_id,
      }),
    });
    const data = await response.json();
    setMessage(response.ok ? "Enrollment removed." : data.error ?? "Failed to remove enrollment.");
    if (response.ok) {
      router.refresh();
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-2 rounded-md border border-border p-3 md:grid-cols-[1fr_1fr_auto]">
        <Select onChange={(e) => setSelectedUserId(e.target.value)} value={selectedUserIdValue}>
          {members.length > 0 ? (
            members.map((member) => (
              <option key={member.clerk_user_id} value={member.clerk_user_id}>
                {getMemberLabel(member)}
              </option>
            ))
          ) : (
            <option value="">No parish members found</option>
          )}
        </Select>

        <Select onChange={(e) => setSelectedCourseId(e.target.value)} value={selectedCourseIdValue}>
          {courses.length > 0 ? (
            courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.title}
              </option>
            ))
          ) : (
            <option value="">No visible courses</option>
          )}
        </Select>

        <Button disabled={!selectedUserIdValue || !selectedCourseIdValue} onClick={addEnrollment} type="button">
          Add enrollment
        </Button>
      </div>

      {enrollments.length > 0 ? (
        <table className="w-full text-left text-sm">
          <thead className="text-muted-foreground">
            <tr>
              <th className="py-2 pr-4 font-medium">Learner</th>
              <th className="py-2 pr-4 font-medium">Course</th>
              <th className="py-2 pr-4 font-medium">Created</th>
              <th className="py-2 pr-4 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {enrollments.map((item) => {
              const member = memberById.get(item.clerk_user_id);
              const course = courseById.get(item.course_id);
              return (
                <tr className="border-t" key={item.id}>
                  <td className="py-2 pr-4">
                    <div className="flex flex-col">
                      <span>{member ? getMemberLabel(member) : item.clerk_user_id}</span>
                      <span className="font-mono text-xs text-muted-foreground">{item.clerk_user_id}</span>
                    </div>
                  </td>
                  <td className="py-2 pr-4">{course?.title ?? item.course_id}</td>
                  <td className="py-2 pr-4">{new Date(item.created_at).toLocaleDateString()}</td>
                  <td className="py-2 pr-4">
                    <Button onClick={() => removeEnrollment(item)} size="sm" type="button" variant="destructive">
                      Remove
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <p className="text-sm text-muted-foreground">No enrollments exist for this parish yet.</p>
      )}

      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
    </div>
  );
}
