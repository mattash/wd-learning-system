"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

import type { DioceseCourseRow } from "@/lib/repositories/diocese-admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

interface CourseDraft {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  scope: "DIOCESE" | "PARISH";
  published: boolean;
}

export function AdminCourseManager({ courses }: { courses: DioceseCourseRow[] }) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newThumbnailUrl, setNewThumbnailUrl] = useState("");
  const [newScope, setNewScope] = useState<"DIOCESE" | "PARISH">("DIOCESE");
  const [newPublished, setNewPublished] = useState(false);
  const [message, setMessage] = useState("");

  // Drafts keyed by course id — local editing state
  const [drafts, setDrafts] = useState<Record<string, CourseDraft>>(
    Object.fromEntries(
      courses.map((course) => [
        course.id,
        {
          id: course.id,
          title: course.title,
          description: course.description ?? "",
          thumbnailUrl: course.thumbnail_url ?? "",
          scope: course.scope,
          published: course.published,
        },
      ]),
    ),
  );

  function startEdit(id: string) {
    setEditingId(id);
  }

  function cancelEdit() {
    setEditingId(null);
  }

  function updateDraft(id: string, field: keyof CourseDraft, value: string | boolean) {
    setDrafts((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
  }

  async function saveCourse(id: string) {
    const draft = drafts[id];
    const response = await fetch(`/api/admin/courses/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: draft.title,
        description: draft.description || null,
        thumbnailUrl: draft.thumbnailUrl || null,
        scope: draft.scope,
        published: draft.published,
      }),
    });

    const data = await response.json();
    setMessage(response.ok ? "Course updated." : data.error ?? "Failed to update course.");
    if (response.ok) {
      setEditingId(null);
      router.refresh();
    }
  }

  async function createCourse() {
    const response = await fetch("/api/admin/courses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: newTitle,
        description: newDescription || null,
        thumbnailUrl: newThumbnailUrl || null,
        scope: newScope,
        published: newPublished,
      }),
    });

    const data = await response.json();
    setMessage(response.ok ? "Course created." : data.error ?? "Failed to create course.");
    if (!response.ok) return;

    setNewTitle("");
    setNewDescription("");
    setNewThumbnailUrl("");
    setNewScope("DIOCESE");
    setNewPublished(false);
    setShowCreateForm(false);
    router.refresh();
  }

  async function deleteCourse(id: string) {
    const response = await fetch(`/api/admin/courses/${id}`, { method: "DELETE" });
    const data = await response.json();
    setMessage(response.ok ? "Course deleted." : data.error ?? "Failed to delete course.");
    if (response.ok) router.refresh();
  }

  return (
    <div>
      {/* Inline create form */}
      {showCreateForm && (
        <div className="border-b border-border bg-brand-subtle p-4">
          <div className="mb-3 text-[13px] font-bold">New course</div>
          <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_120px_140px_auto]">
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-muted-foreground">Title</label>
              <Input
                className="h-[34px] text-[13px]"
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Course title"
                value={newTitle}
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-muted-foreground">Description</label>
              <Input
                className="h-[34px] text-[13px]"
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Short description"
                value={newDescription}
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-muted-foreground">Scope</label>
              <Select
                className="h-[34px] text-[13px]"
                onChange={(e) => setNewScope(e.target.value as "DIOCESE" | "PARISH")}
                value={newScope}
              >
                <option value="DIOCESE">Diocese</option>
                <option value="PARISH">Parish</option>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-muted-foreground">Thumbnail URL</label>
              <Input
                className="h-[34px] text-[13px]"
                onChange={(e) => setNewThumbnailUrl(e.target.value)}
                placeholder="https://..."
                value={newThumbnailUrl}
              />
            </div>
            <div className="flex gap-1.5">
              <Button onClick={createCourse} size="sm" type="button">
                Create
              </Button>
              <Button onClick={() => setShowCreateForm(false)} size="sm" type="button" variant="ghost">
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Show inline create toggle only when form is closed */}
      {!showCreateForm && (
        <div className="border-b border-border px-5 py-2.5">
          <button
            onClick={() => setShowCreateForm(true)}
            className="text-[13px] text-primary hover:underline"
            type="button"
          >
            + Add a course inline
          </button>
        </div>
      )}

      {/* Course table */}
      <table className="w-full text-left">
        <thead>
          <tr>
            <th className="px-3.5 py-2.5 text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground">
              Title
            </th>
            <th className="px-3.5 py-2.5 w-24 text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground">
              Thumbnail
            </th>
            <th className="px-3.5 py-2.5 text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground">
              Scope
            </th>
            <th className="px-3.5 py-2.5 text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground">
              Published
            </th>
            <th className="px-3.5 py-2.5 text-right text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground">
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {courses.map((course) => {
            const draft = drafts[course.id];
            const isEditing = editingId === course.id;

            if (isEditing) {
              return (
                <tr className="border-t border-border bg-brand-subtle" key={course.id}>
                  <td className="px-3.5 py-3" colSpan={2}>
                    <Input
                      className="mb-2 h-[32px] text-[13px]"
                      value={draft.title}
                      onChange={(e) => updateDraft(course.id, "title", e.target.value)}
                    />
                    <Input
                      className="h-[32px] text-[13px]"
                      placeholder="Description (optional)"
                      value={draft.description}
                      onChange={(e) => updateDraft(course.id, "description", e.target.value)}
                    />
                  </td>
                  <td className="px-3.5 py-3">
                    <div className="h-10 w-16 overflow-hidden rounded border bg-muted">
                      {draft.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          alt={draft.title}
                          className="h-full w-full object-cover"
                          src={draft.thumbnailUrl}
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                          }}
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-muted-foreground">
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} />
                          </svg>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-3.5 py-3">
                    <Input
                      className="h-[32px] text-[13px]"
                      placeholder="Thumbnail URL"
                      value={draft.thumbnailUrl}
                      onChange={(e) => updateDraft(course.id, "thumbnailUrl", e.target.value)}
                    />
                  </td>
                  <td className="px-3.5 py-3">
                    <label className="flex cursor-pointer items-center gap-2 text-[13px]">
                      <input
                        type="checkbox"
                        checked={draft.published}
                        onChange={(e) => updateDraft(course.id, "published", e.target.checked)}
                        className="accent-primary"
                      />
                      Published
                    </label>
                  </td>
                  <td className="px-3.5 py-3 text-right">
                    <div className="flex justify-end gap-1.5">
                      <Button onClick={() => saveCourse(course.id)} size="xs" type="button">
                        Save
                      </Button>
                      <Button onClick={cancelEdit} size="xs" type="button" variant="ghost">
                        Cancel
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            }

            return (
              <tr className="border-t border-border hover:bg-secondary" key={course.id}>
                <td className="px-3.5 py-3">
                  <div className="h-10 w-16 overflow-hidden rounded border bg-muted">
                    {draft.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        alt={course.title}
                        className="h-full w-full object-cover"
                        src={draft.thumbnailUrl}
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-muted-foreground">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} />
                        </svg>
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-3.5 py-3">
                  <Badge variant={course.scope === "PARISH" ? "parish" : "diocese"}>
                    {course.scope === "PARISH" ? "Parish" : "Diocese-wide"}
                  </Badge>
                </td>
                <td className="px-3.5 py-3">
                  {course.published ? (
                    <Badge variant="success">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-success" />
                      Published
                    </Badge>
                  ) : (
                    <Badge>Draft</Badge>
                  )}
                </td>
                <td className="px-3.5 py-3 text-right">
                  <div className="flex justify-end gap-1.5">
                    <Button asChild size="xs" type="button" variant="secondary">
                      <Link href={`/app/admin/courses/${course.id}`}>Manage content</Link>
                    </Button>
                    <Button onClick={() => startEdit(course.id)} size="xs" type="button" variant="ghost">
                      Edit
                    </Button>
                    <Button onClick={() => deleteCourse(course.id)} size="xs" type="button" variant="destructive">
                      Delete
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {message ? (
        <p className="px-5 py-3 text-[13px] text-muted-foreground">{message}</p>
      ) : null}
    </div>
  );
}