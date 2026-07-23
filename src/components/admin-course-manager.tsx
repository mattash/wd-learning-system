"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { readErrorMessage } from "@/lib/errors";

import type { DioceseCourseRow } from "@/lib/repositories/diocese-admin";
import type { CourseCategory } from "@/lib/course-metadata";
import { COURSE_CATEGORIES } from "@/lib/course-metadata";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CopyCourseLinkButton } from "@/components/copy-course-link-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const SUPPORTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;

type CourseScope = "DIOCESE" | "PARISH";

interface CourseFormState {
  title: string;
  description: string;
  instructor: string;
  durationHours: string;
  category: CourseCategory | "";
  thumbnailUrl: string;
  scope: CourseScope;
  published: boolean;
  publiclyBrowseable: boolean;
}

const emptyForm: CourseFormState = {
  title: "",
  description: "",
  instructor: "",
  durationHours: "",
  category: "",
  thumbnailUrl: "",
  scope: "DIOCESE",
  published: false,
  publiclyBrowseable: false,
};

type EditorMode = { kind: "create" } | { kind: "edit"; id: string };

export function AdminCourseManager({ courses }: { courses: DioceseCourseRow[] }) {
  const router = useRouter();
  const [editorMode, setEditorMode] = useState<EditorMode | null>(null);
  const [form, setForm] = useState<CourseFormState>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [formError, setFormError] = useState("");
  const [pendingDelete, setPendingDelete] = useState<DioceseCourseRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState("");

  function openCreate() {
    setForm(emptyForm);
    setFormError("");
    setEditorMode({ kind: "create" });
  }

  function openEdit(course: DioceseCourseRow) {
    setForm({
      title: course.title,
      description: course.description ?? "",
      instructor: course.instructor ?? "",
      durationHours: course.duration_hours ? String(course.duration_hours) : "",
      category: course.category ?? "",
      thumbnailUrl: course.thumbnail_url ?? "",
      scope: course.scope,
      published: course.published,
      publiclyBrowseable: course.publicly_browseable,
    });
    setFormError("");
    setEditorMode({ kind: "edit", id: course.id });
  }

  function closeEditor() {
    setEditorMode(null);
    setFormError("");
  }

  async function handleImageUpload(file: File) {
    if (!SUPPORTED_IMAGE_TYPES.includes(file.type as (typeof SUPPORTED_IMAGE_TYPES)[number])) {
      setFormError("Unsupported image type. Use JPG, PNG, WEBP, or GIF.");
      return;
    }

    if (file.size > MAX_IMAGE_BYTES) {
      setFormError("Image too large. Max upload size is 5 MB.");
      return;
    }

    setUploading(true);
    setFormError("");

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
      const uploadData = await uploadRequest.json();

      if (!uploadRequest.ok) {
        setFormError(uploadData.error ?? "Failed to start upload.");
        return;
      }

      const putResponse = await fetch(uploadData.uploadUrl as string, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!putResponse.ok) {
        setFormError("Image upload failed.");
        return;
      }

      setForm((prev) => ({ ...prev, thumbnailUrl: uploadData.assetUrl as string }));
    } catch {
      setFormError("Image upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function submitForm() {
    if (!editorMode) return;

    const title = form.title.trim();
    if (!title) {
      setFormError("Title is required.");
      return;
    }

    setSubmitting(true);
    setFormError("");

    const isEdit = editorMode.kind === "edit";
    const url = isEdit ? `/api/admin/courses/${editorMode.id}` : "/api/admin/courses";
    const method = isEdit ? "PATCH" : "POST";

    try {
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: form.description.trim() || null,
          instructor: form.instructor.trim() || null,
          durationHours: form.durationHours ? Number(form.durationHours) : null,
          category: form.category || null,
          thumbnailUrl: form.thumbnailUrl || null,
          scope: form.scope,
          published: form.published,
          publiclyBrowseable: form.publiclyBrowseable,
        }),
      });

      if (!response.ok) {
        setFormError(await readErrorMessage(response, isEdit ? "Failed to update course." : "Failed to create course."));
        return;
      }

      setMessage(isEdit ? "Course updated." : "Course created.");
      closeEditor();
      router.refresh();
    } catch {
      setFormError(isEdit ? "Failed to update course." : "Failed to create course.");
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      const response = await fetch(`/api/admin/courses/${pendingDelete.id}`, { method: "DELETE" });
      if (!response.ok) {
        setMessage(await readErrorMessage(response, "Failed to delete course."));
        return;
      }
      setMessage("Course deleted.");
      setPendingDelete(null);
      router.refresh();
    } catch {
      setMessage("Failed to delete course.");
    } finally {
      setDeleting(false);
    }
  }

  const isEditMode = editorMode?.kind === "edit";

  return (
    <div>
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <p className="text-[13px] text-muted-foreground">
          {courses.length} course{courses.length === 1 ? "" : "s"}
        </p>
        <Button onClick={openCreate} size="sm" type="button">
          + Create course
        </Button>
      </div>

      <table className="w-full table-fixed text-left">
        <colgroup>
          <col />
          <col className="w-[140px]" />
          <col className="w-[100px]" />
          <col className="w-[100px]" />
          <col className="w-[280px]" />
        </colgroup>
        <thead>
          <tr>
            <th className="px-3.5 py-2.5 text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground">Course</th>
            <th className="px-3.5 py-2.5 text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground">Scope</th>
            <th className="px-3.5 py-2.5 text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground">Published</th>
            <th className="px-3.5 py-2.5 text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground">Public</th>
            <th className="px-3.5 py-2.5 text-right text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground">Actions</th>
          </tr>
        </thead>
        <tbody>
          {courses.map((course) => (
            <tr className="border-t border-border hover:bg-secondary" key={course.id}>
              <td className="px-3.5 py-3">
                <div className="flex items-center gap-3">
                  <CourseThumbnail description={course.description ?? null} title={course.title} url={course.thumbnail_url ?? null} />
                  <div className="min-w-0">
                    <strong className="block truncate text-[13.5px]">{course.title}</strong>
                    {course.description ? (
                      <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{course.description}</div>
                    ) : null}
                  </div>
                </div>
              </td>
              <td className="px-3.5 py-3">
                <Badge variant={course.scope === "PARISH" ? "parish" : "diocese"}>
                  {course.scope === "PARISH" ? "Parish" : "Shared"}
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
              <td className="px-3.5 py-3">
                {course.publicly_browseable ? (
                  <Badge variant="success">Yes</Badge>
                ) : (
                  <span className="text-xs text-muted-foreground">No</span>
                )}
              </td>
              <td className="px-3.5 py-3 text-right">
                <div className="flex justify-end gap-1.5">
                  <CopyCourseLinkButton courseId={course.id} published={course.published} />
                  <Button asChild size="xs" type="button" variant="secondary">
                    <Link href={`/app/admin/courses/${course.id}`}>Manage content</Link>
                  </Button>
                  <Button onClick={() => openEdit(course)} size="xs" type="button" variant="ghost">
                    Edit
                  </Button>
                  <Button onClick={() => setPendingDelete(course)} size="xs" type="button" variant="destructive">
                    Delete
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {message ? <p className="px-5 py-3 text-[13px] text-muted-foreground">{message}</p> : null}

      <Dialog onOpenChange={(next) => (next ? null : closeEditor())} open={editorMode !== null}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{isEditMode ? "Edit course" : "Create course"}</DialogTitle>
            <DialogDescription>
              {isEditMode
                ? "Update this course's catalog details. Use Manage content to edit modules and lessons."
                : "Add a new course to the shared catalog. You can change details later."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-muted-foreground" htmlFor="course-title">
                Title <span className="text-destructive">*</span>
              </label>
              <Input
                id="course-title"
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="e.g. Foundations of the Catholic Faith"
                value={form.title}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-muted-foreground" htmlFor="course-description">
                Description
              </label>
              <Textarea
                id="course-description"
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Short summary shown in the catalog"
                rows={3}
                value={form.description}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-muted-foreground" htmlFor="course-instructor">
                  Instructor
                </label>
                <Input
                  id="course-instructor"
                  onChange={(e) => setForm((prev) => ({ ...prev, instructor: e.target.value }))}
                  placeholder="e.g. Fr. Hovsep Karapetian"
                  value={form.instructor}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-muted-foreground" htmlFor="course-duration-hours">
                  Duration hours
                </label>
                <Input
                  id="course-duration-hours"
                  min="0.25"
                  onChange={(e) => setForm((prev) => ({ ...prev, durationHours: e.target.value }))}
                  placeholder="6"
                  step="0.25"
                  type="number"
                  value={form.durationHours}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-muted-foreground" htmlFor="course-category">
                  Category
                </label>
                <Select
                  id="course-category"
                  onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value as CourseCategory | "" }))}
                  value={form.category}
                >
                  <option value="">None</option>
                  {COURSE_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div>
              <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">Cover image</span>
              <div className="flex items-start gap-3">
                <CourseThumbnail
                  description={null}
                  size="lg"
                  title={form.title || "Course"}
                  url={form.thumbnailUrl || null}
                />
                <div className="flex flex-1 flex-col gap-2">
                  <Input
                    accept={SUPPORTED_IMAGE_TYPES.join(",")}
                    aria-label="Upload cover image"
                    disabled={uploading}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.target.value = "";
                      if (!file) return;
                      void handleImageUpload(file);
                    }}
                    type="file"
                  />
                  <Input
                    onChange={(e) => setForm((prev) => ({ ...prev, thumbnailUrl: e.target.value }))}
                    placeholder="Or paste an image URL"
                    value={form.thumbnailUrl}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    {uploading ? "Uploading…" : "JPG, PNG, WEBP, or GIF. Max 5 MB."}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-muted-foreground" htmlFor="course-scope">
                  Scope
                </label>
                <Select
                  id="course-scope"
                  onChange={(e) => setForm((prev) => ({ ...prev, scope: e.target.value as CourseScope }))}
                  value={form.scope}
                >
                  <option value="DIOCESE">Shared</option>
                  <option value="PARISH">Parish</option>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <label className="flex cursor-pointer items-center gap-2 text-sm" htmlFor="course-published">
                  <Checkbox
                    checked={form.published}
                    id="course-published"
                    onChange={(e) => setForm((prev) => ({ ...prev, published: e.target.checked }))}
                  />
                  {isEditMode ? "Published" : "Publish immediately"}
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm" htmlFor="course-publicly-browseable">
                  <Checkbox
                    checked={form.publiclyBrowseable}
                    id="course-publicly-browseable"
                    onChange={(e) => setForm((prev) => ({ ...prev, publiclyBrowseable: e.target.checked }))}
                  />
                  Publicly browseable
                </label>
              </div>
            </div>

            {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
          </div>

          <DialogFooter>
            <Button onClick={closeEditor} type="button" variant="ghost">
              Cancel
            </Button>
            <Button disabled={submitting || uploading} onClick={submitForm} type="button">
              {submitting
                ? isEditMode
                  ? "Saving…"
                  : "Creating…"
                : isEditMode
                  ? "Save changes"
                  : "Create course"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog onOpenChange={(next) => (next ? null : setPendingDelete(null))} open={pendingDelete !== null}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete course?</DialogTitle>
            <DialogDescription>
              This permanently removes <strong className="font-semibold text-foreground">{pendingDelete?.title}</strong> and all of its modules, lessons, and questions. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button disabled={deleting} onClick={() => setPendingDelete(null)} type="button" variant="ghost">
              Cancel
            </Button>
            <Button disabled={deleting} onClick={confirmDelete} type="button" variant="destructive">
              {deleting ? "Deleting…" : "Delete course"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CourseThumbnail({
  description,
  size = "sm",
  title,
  url,
}: {
  description: string | null;
  size?: "sm" | "lg";
  title: string;
  url: string | null;
}) {
  const dimensions = size === "lg" ? "h-20 w-28" : "h-10 w-14";

  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- next/image is not configured for R2 hosts; thumbnails are small.
      <img
        alt={description ? `${title} — ${description}` : title}
        className={`${dimensions} flex-shrink-0 rounded-md border border-border object-cover`}
        src={url}
      />
    );
  }

  return (
    <div
      aria-hidden="true"
      className={`${dimensions} flex flex-shrink-0 items-center justify-center rounded-md border border-dashed border-border bg-muted text-[10px] font-semibold uppercase tracking-wide text-muted-foreground`}
    >
      No image
    </div>
  );
}
