"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type { DioceseCourseRow, DioceseEnrollmentRow, DioceseParishRow } from "@/lib/repositories/diocese-admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

interface EnrollmentView extends DioceseEnrollmentRow {
  parishName: string;
  courseTitle: string;
}

export function AdminEnrollmentManager({
  enrollments,
  parishes,
  courses,
}: {
  enrollments: DioceseEnrollmentRow[];
  parishes: DioceseParishRow[];
  courses: DioceseCourseRow[];
}) {
  const router = useRouter();
  const [parishId, setParishId] = useState(parishes[0]?.id ?? "");
  const [courseId, setCourseId] = useState(courses[0]?.id ?? "");
  const [clerkUserId, setClerkUserId] = useState("");
  const [message, setMessage] = useState("");

  const parishById = useMemo(() => new Map(parishes.map((parish) => [parish.id, parish.name])), [parishes]);
  const courseById = useMemo(() => new Map(courses.map((course) => [course.id, course.title])), [courses]);

  const viewRows: EnrollmentView[] = enrollments.map((item) => ({
    ...item,
    parishName: parishById.get(item.parish_id) ?? item.parish_id,
    courseTitle: courseById.get(item.course_id) ?? item.course_id,
  }));

  async function addEnrollment() {
    const response = await fetch("/api/admin/enrollments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parishId, courseId, clerkUserId }),
    });

    const data = await response.json();
    setMessage(response.ok ? "Enrollment saved." : data.error ?? "Failed to save enrollment.");
    if (response.ok) {
      setClerkUserId("");
      router.refresh();
    }
  }

  async function removeEnrollment(item: DioceseEnrollmentRow) {
    const response = await fetch("/api/admin/enrollments", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        parishId: item.parish_id,
        clerkUserId: item.clerk_user_id,
        courseId: item.course_id,
      }),
    });

    const data = await response.json();
    setMessage(response.ok ? "Enrollment removed." : data.error ?? "Failed to remove enrollment.");
    if (response.ok) router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-2 rounded-md border border-border p-3 md:grid-cols-4">
        <Select onChange={(e) => setParishId(e.target.value)} value={parishId}>
          {parishes.map((parish) => (
            <option key={parish.id} value={parish.id}>
              {parish.name}
            </option>
          ))}
        </Select>

        <Select onChange={(e) => setCourseId(e.target.value)} value={courseId}>
          {courses.map((course) => (
            <option key={course.id} value={course.id}>
              {course.title}
            </option>
          ))}
        </Select>

        <Input onChange={(e) => setClerkUserId(e.target.value)} placeholder="clerk_user_id" value={clerkUserId} />

        <Button onClick={addEnrollment} type="button">
          Add enrollment
        </Button>
      </div>

      <table className="w-full text-left text-sm">
        <thead className="text-muted-foreground">
          <tr>
            <th className="py-2 pr-4 font-medium">Parish</th>
            <th className="py-2 pr-4 font-medium">Course</th>
            <th className="py-2 pr-4 font-medium">User</th>
            <th className="py-2 pr-4 font-medium">Created</th>
            <th className="py-2 pr-4 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {viewRows.map((item) => (
            <tr className="border-t" key={item.id}>
              <td className="py-2 pr-4">{item.parishName}</td>
              <td className="py-2 pr-4">{item.courseTitle}</td>
              <td className="py-2 pr-4 font-mono text-xs">{item.clerk_user_id}</td>
              <td className="py-2 pr-4">{new Date(item.created_at).toLocaleDateString()}</td>
              <td className="py-2 pr-4">
                <Button onClick={() => removeEnrollment(item)} size="sm" type="button" variant="destructive">
                  Remove
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
    </div>
  );
}
