"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import type { ParishAdminCourseRow } from "@/lib/repositories/parish-admin";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";

export function ParishCourseAdoptionManager({
  adoptedCourses,
  availableCourses,
}: {
  adoptedCourses: ParishAdminCourseRow[];
  availableCourses: ParishAdminCourseRow[];
}) {
  const router = useRouter();
  const [selectedCourseId, setSelectedCourseId] = useState(availableCourses[0]?.id ?? "");
  const [message, setMessage] = useState("");
  const selectedCourseIdValue = availableCourses.some((course) => course.id === selectedCourseId)
    ? selectedCourseId
    : (availableCourses[0]?.id ?? "");

  async function adoptCourse() {
    if (!selectedCourseIdValue) return;

    const response = await fetch("/api/parish-admin/course-adoptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseId: selectedCourseIdValue }),
    });
    const data = await response.json();
    setMessage(response.ok ? "Course adopted for this parish." : data.error ?? "Failed to adopt course.");
    if (!response.ok) return;

    router.refresh();
  }

  async function removeAdoption(courseId: string) {
    const response = await fetch("/api/parish-admin/course-adoptions", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseId }),
    });
    const data = await response.json();
    setMessage(response.ok ? "Course removed from parish adoptions." : data.error ?? "Failed to remove course.");
    if (response.ok) {
      router.refresh();
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-2 rounded-md border border-border p-3 md:grid-cols-[1fr_auto]">
        <Select onChange={(e) => setSelectedCourseId(e.target.value)} value={selectedCourseIdValue}>
          {availableCourses.length > 0 ? (
            availableCourses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.title}
              </option>
            ))
          ) : (
            <option value="">No additional parish courses available</option>
          )}
        </Select>
        <Button disabled={!selectedCourseIdValue} onClick={adoptCourse} type="button">
          Adopt course
        </Button>
      </div>

      {adoptedCourses.length > 0 ? (
        <table className="w-full text-left text-sm">
          <thead className="text-muted-foreground">
            <tr>
              <th className="py-2 pr-4 font-medium">Course</th>
              <th className="py-2 pr-4 font-medium">Description</th>
              <th className="py-2 pr-4 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {adoptedCourses.map((course) => (
              <tr className="border-t" key={course.id}>
                <td className="py-2 pr-4">{course.title}</td>
                <td className="py-2 pr-4 text-muted-foreground">{course.description ?? "No description"}</td>
                <td className="py-2 pr-4">
                  <Button onClick={() => removeAdoption(course.id)} size="sm" type="button" variant="destructive">
                    Remove
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-sm text-muted-foreground">No parish-scoped courses are adopted yet.</p>
      )}

      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
    </div>
  );
}
