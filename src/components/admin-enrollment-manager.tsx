"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type { DioceseCourseRow, DioceseEnrollmentRow, DioceseParishRow } from "@/lib/repositories/diocese-admin";
import { Badge } from "@/components/ui/badge";
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
  const [showCreateForm, setShowCreateForm] = useState(false);
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
      setShowCreateForm(false);
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
    <div>
      {/* Inline create form */}
      {showCreateForm && (
        <div className="border-b border-border bg-brand-subtle p-4">
          <div className="mb-3 text-[13px] font-bold">New enrollment</div>
          <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto]">
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-muted-foreground">Parish</label>
              <Select className="h-[34px] text-[13px]" onChange={(e) => setParishId(e.target.value)} value={parishId}>
                {parishes.map((parish) => (
                  <option key={parish.id} value={parish.id}>
                    {parish.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-muted-foreground">Course</label>
              <Select className="h-[34px] text-[13px]" onChange={(e) => setCourseId(e.target.value)} value={courseId}>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.title}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-muted-foreground">User</label>
              <Input className="h-[34px] text-[13px]" onChange={(e) => setClerkUserId(e.target.value)} placeholder="clerk_user_id" value={clerkUserId} />
            </div>
            <div className="flex gap-1.5">
              <Button onClick={addEnrollment} size="sm" type="button">Enroll</Button>
              <Button onClick={() => setShowCreateForm(false)} size="sm" type="button" variant="ghost">Cancel</Button>
            </div>
          </div>
        </div>
      )}

      {!showCreateForm && (
        <div className="flex justify-end border-b border-border px-5 py-3">
          <Button onClick={() => setShowCreateForm(true)} size="sm" type="button">+ Add enrollment</Button>
        </div>
      )}

      {/* Enrollment table */}
      <table className="w-full text-left">
        <thead>
          <tr>
            <th className="px-3.5 py-2.5 text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground">Parish</th>
            <th className="px-3.5 py-2.5 text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground">Course</th>
            <th className="px-3.5 py-2.5 text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground">User</th>
            <th className="px-3.5 py-2.5 text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground">Enrolled</th>
            <th className="px-3.5 py-2.5 text-right text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground">Actions</th>
          </tr>
        </thead>
        <tbody>
          {viewRows.map((item) => (
            <tr className="border-t border-border hover:bg-secondary" key={item.id}>
              <td className="px-3.5 py-3">
                <Badge variant="parish">{item.parishName}</Badge>
              </td>
              <td className="px-3.5 py-3 text-[13px] font-semibold">{item.courseTitle}</td>
              <td className="px-3.5 py-3 font-mono text-[12px] text-muted-foreground">{item.clerk_user_id}</td>
              <td className="px-3.5 py-3 text-[13px] text-muted-foreground">
                {new Date(item.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </td>
              <td className="px-3.5 py-3 text-right">
                <Button onClick={() => removeEnrollment(item)} size="xs" type="button" variant="destructive">
                  Remove
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Footer */}
      <div className="flex items-center justify-between rounded-b-lg border-t border-border bg-secondary px-5 py-3">
        <span className="text-xs text-muted-foreground">
          {viewRows.length} enrollments
        </span>
      </div>

      {message ? <p className="px-5 py-3 text-[13px] text-muted-foreground">{message}</p> : null}
    </div>
  );
}
