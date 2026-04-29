"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

import type { DioceseCourseRow } from "@/lib/repositories/diocese-admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const SUPPORTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;

export function AdminCourseManager({ courses }: { courses: DioceseCourseRow[] }) {
  const router = useRouter();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newThumbnailUrl, setNewThumbnailUrl] = useState("");
  const [newScope, setNewScope] = useState<"DIOCESE" | "PARISH">("DIOCESE");
  const [newPublished, setNewPublished] = useState(false);
  const [message, setMessage] = useState("");
  const [uploadingTarget, setUploadingTarget] = useState<string | null>(null);
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

  async function uploadThumbnailImage({
    file,
    targetId,
    onUploaded,
  }: {
    file: File;
    targetId: string;
    onUploaded: (url: string) => void;
  }) {
    if (!SUPPORTED_IMAGE_TYPES.includes(file.type as (typeof SUPPORTED_IMAGE_TYPES)[number])) {
      setMessage("Unsupported image type. Use JPG, PNG, WEBP, or GIF.");
      return;
    }

    if (file.size > MAX_IMAGE_BYTES) {
      setMessage("Image too large. Max upload size is 5 MB.");
      return;
    }

    setUploadingTarget(targetId);

    try {
      const uploadRequest = await fetch("/api/admin/uploads/images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "course",
          fileName: file.name,
          contentType: file.type,
          size: file.size,
        }),
      });
      const uploadRequestData = await uploadRequest.json();

      if (!uploadRequest.ok) {
        setMessage(uploadRequestData.error ?? "Failed to start upload.");
        return;
      }

      const uploadResponse = await fetch(uploadRequestData.uploadUrl as string, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!uploadResponse.ok) {
        setMessage("Image upload failed.");
        return;
      }

      onUploaded(uploadRequestData.assetUrl as string);
      setMessage("Thumbnail uploaded. Save to persist the new URL.");
    } catch {
      setMessage("Image upload failed.");
    } finally {
      setUploadingTarget(null);
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
    if (response.ok) router.refresh();
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
              <Input className="h-[34px] text-[13px]" onChange={(e) => setNewTitle(e.target.value)} placeholder="Course title" value={newTitle} />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-muted-foreground">Description</label>
              <Input className="h-[34px] text-[13px]" onChange={(e) => setNewDescription(e.target.value)} placeholder="Short description" value={newDescription} />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-muted-foreground">Scope</label>
              <Select className="h-[34px] text-[13px]" onChange={(e) => setNewScope(e.target.value as "DIOCESE" | "PARISH")} value={newScope}>
                <option value="DIOCESE">Diocese</option>
                <option value="PARISH">Parish</option>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-muted-foreground">Thumbnail URL</label>
              <Input className="h-[34px] text-[13px]" onChange={(e) => setNewThumbnailUrl(e.target.value)} placeholder="https://..." value={newThumbnailUrl} />
            </div>
            <div className="flex gap-1.5">
              <Button onClick={createCourse} size="sm" type="button">Create</Button>
              <Button onClick={() => setShowCreateForm(false)} size="sm" type="button" variant="ghost">Cancel</Button>
            </div>
          </div>
        </div>
      )}

      {!showCreateForm && (
        <div className="flex justify-end border-b border-border px-5 py-3">
          <Button onClick={() => setShowCreateForm(true)} size="sm" type="button">+ Create course</Button>
        </div>
      )}

      {/* Course table */}
      <table className="w-full text-left">
        <thead>
          <tr>
            <th className="px-3.5 py-2.5 text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground">Title</th>
            <th className="px-3.5 py-2.5 text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground">Scope</th>
            <th className="px-3.5 py-2.5 text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground">Published</th>
            <th className="px-3.5 py-2.5 text-right text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground">Actions</th>
          </tr>
        </thead>
        <tbody>
          {courses.map((course) => {
            const draft = drafts[course.id];
            return (
              <tr className="border-t border-border hover:bg-secondary" key={course.id}>
                <td className="px-3.5 py-3">
                  <strong className="text-[13.5px]">{draft?.title ?? course.title}</strong>
                  <div className="mt-0.5 text-xs text-muted-foreground">{draft?.description ?? course.description ?? ""}</div>
                </td>
                <td className="px-3.5 py-3">
                  <Badge variant={(draft?.scope ?? course.scope) === "PARISH" ? "parish" : "diocese"}>
                    {(draft?.scope ?? course.scope) === "PARISH" ? "Parish" : "Diocese-wide"}
                  </Badge>
                </td>
                <td className="px-3.5 py-3">
                  {(draft?.published ?? course.published) ? (
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
                    <Button onClick={() => saveCourse(course.id)} size="xs" type="button" variant="ghost">Edit</Button>
                    <Button onClick={() => deleteCourse(course.id)} size="xs" type="button" variant="destructive">Delete</Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {message ? <p className="px-5 py-3 text-[13px] text-muted-foreground">{message}</p> : null}
    </div>
  );
}
