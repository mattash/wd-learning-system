"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

import type { DioceseCourseRow } from "@/lib/repositories/diocese-admin";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

interface CourseDraft {
  id: string;
  title: string;
  description: string;
  scope: "DIOCESE" | "PARISH";
  published: boolean;
}

export function AdminCourseManager({ courses }: { courses: DioceseCourseRow[] }) {
  const router = useRouter();
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newScope, setNewScope] = useState<"DIOCESE" | "PARISH">("DIOCESE");
  const [newPublished, setNewPublished] = useState(false);
  const [message, setMessage] = useState("");
  const [drafts, setDrafts] = useState<Record<string, CourseDraft>>(
    Object.fromEntries(
      courses.map((course) => [
        course.id,
        {
          id: course.id,
          title: course.title,
          description: course.description ?? "",
          scope: course.scope,
          published: course.published,
        },
      ]),
    ),
  );

  async function createCourse() {
    const response = await fetch("/api/admin/courses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: newTitle,
        description: newDescription || null,
        scope: newScope,
        published: newPublished,
      }),
    });

    const data = await response.json();
    setMessage(response.ok ? "Course created." : data.error ?? "Failed to create course.");
    if (!response.ok) return;

    setNewTitle("");
    setNewDescription("");
    setNewScope("DIOCESE");
    setNewPublished(false);
    router.refresh();
  }

  async function saveCourse(id: string) {
    const draft = drafts[id];
    const response = await fetch(`/api/admin/courses/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: draft.title,
        description: draft.description || null,
        scope: draft.scope,
        published: draft.published,
      }),
    });

    const data = await response.json();
    setMessage(response.ok ? "Course updated." : data.error ?? "Failed to update course.");
    if (response.ok) router.refresh();
  }

  async function deleteCourse(id: string) {
    const response = await fetch(`/api/admin/courses/${id}`, { method: "DELETE" });
    const data = await response.json();
    setMessage(response.ok ? "Course deleted." : data.error ?? "Failed to delete course.");
    if (response.ok) router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-2 rounded-md border border-border p-3 md:grid-cols-5">
        <Input onChange={(e) => setNewTitle(e.target.value)} placeholder="New course title" value={newTitle} />
        <Input
          onChange={(e) => setNewDescription(e.target.value)}
          placeholder="Description (optional)"
          value={newDescription}
        />
        <Select onChange={(e) => setNewScope(e.target.value as "DIOCESE" | "PARISH")} value={newScope}>
          <option value="DIOCESE">DIOCESE</option>
          <option value="PARISH">PARISH</option>
        </Select>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={newPublished} onChange={(e) => setNewPublished(e.target.checked)} />
          Published
        </label>
        <Button onClick={createCourse} type="button">
          Create course
        </Button>
      </div>

      <table className="w-full text-left text-sm">
        <thead className="text-muted-foreground">
          <tr>
            <th className="py-2 pr-4 font-medium">Title</th>
            <th className="py-2 pr-4 font-medium">Description</th>
            <th className="py-2 pr-4 font-medium">Scope</th>
            <th className="py-2 pr-4 font-medium">Published</th>
            <th className="py-2 pr-4 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {courses.map((course) => {
            const draft = drafts[course.id];
            return (
              <tr className="border-t" key={course.id}>
                <td className="py-2 pr-4">
                  <Input
                    onChange={(e) =>
                      setDrafts((prev) => ({ ...prev, [course.id]: { ...prev[course.id], title: e.target.value } }))
                    }
                    value={draft?.title ?? course.title}
                  />
                </td>
                <td className="py-2 pr-4">
                  <Input
                    onChange={(e) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [course.id]: { ...prev[course.id], description: e.target.value },
                      }))
                    }
                    value={draft?.description ?? course.description ?? ""}
                  />
                </td>
                <td className="py-2 pr-4">
                  <Select
                    onChange={(e) =>
                      setDrafts((prev) => ({
                        ...prev,
                        [course.id]: { ...prev[course.id], scope: e.target.value as "DIOCESE" | "PARISH" },
                      }))
                    }
                    value={draft?.scope ?? course.scope}
                  >
                    <option value="DIOCESE">DIOCESE</option>
                    <option value="PARISH">PARISH</option>
                  </Select>
                </td>
                <td className="py-2 pr-4">
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={draft?.published ?? course.published}
                      onChange={(e) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [course.id]: { ...prev[course.id], published: e.target.checked },
                        }))
                      }
                    />
                    Published
                  </label>
                </td>
                <td className="py-2 pr-4">
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => saveCourse(course.id)} size="sm" type="button" variant="secondary">
                      Save
                    </Button>
                    <Button asChild size="sm" type="button" variant="outline">
                      <Link href={`/app/admin/courses/${course.id}`}>Manage content</Link>
                    </Button>
                    <Button onClick={() => deleteCourse(course.id)} size="sm" type="button" variant="destructive">
                      Delete
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
    </div>
  );
}
