"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import type { DioceseModuleRow } from "@/lib/repositories/diocese-admin";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

interface ModuleDraft {
  title: string;
  descriptor: string;
  thumbnailUrl: string;
}

interface LessonDraft {
  title: string;
  descriptor: string;
  thumbnailUrl: string;
  youtubeVideoId: string;
  passingScore: string;
}

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const SUPPORTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;

function buildModuleDrafts(modules: DioceseModuleRow[]) {
  return Object.fromEntries(
    modules.map((module) => [
      module.id,
      {
        title: module.title,
        descriptor: module.descriptor ?? "",
        thumbnailUrl: module.thumbnail_url ?? "",
      },
    ]),
  ) as Record<string, ModuleDraft>;
}

function buildLessonDrafts(modules: DioceseModuleRow[]) {
  return Object.fromEntries(
    modules.flatMap((module) =>
      module.lessons.map((lesson) => [
        lesson.id,
        {
          title: lesson.title,
          descriptor: lesson.descriptor ?? "",
          thumbnailUrl: lesson.thumbnail_url ?? "",
          youtubeVideoId: lesson.youtube_video_id,
          passingScore: String(lesson.passing_score),
        },
      ]),
    ),
  ) as Record<string, LessonDraft>;
}

export function AdminCourseContentManager({
  course,
  modules,
}: {
  course: {
    id: string;
    title: string;
    description: string | null;
    scope: "DIOCESE" | "PARISH";
    published: boolean;
  };
  modules: DioceseModuleRow[];
}) {
  const courseId = course.id;
  const router = useRouter();
  const [newModuleTitle, setNewModuleTitle] = useState("");
  const [newModuleDescriptor, setNewModuleDescriptor] = useState("");
  const [newModuleThumbnailUrl, setNewModuleThumbnailUrl] = useState("");
  const [courseScope, setCourseScope] = useState<"DIOCESE" | "PARISH">(course.scope);
  const [message, setMessage] = useState("");
  const [uploadingTarget, setUploadingTarget] = useState<string | null>(null);
  const [moduleDrafts, setModuleDrafts] = useState<Record<string, ModuleDraft>>(() => buildModuleDrafts(modules));
  const [lessonDrafts, setLessonDrafts] = useState<Record<string, LessonDraft>>(() => buildLessonDrafts(modules));

  useEffect(() => {
    setModuleDrafts(buildModuleDrafts(modules));
    setLessonDrafts(buildLessonDrafts(modules));
  }, [modules]);

  async function uploadThumbnailImage({
    file,
    kind,
    targetId,
    onUploaded,
  }: {
    file: File;
    kind: "course" | "module" | "lesson" | "misc";
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
          kind,
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

  async function saveCourseScope() {
    const response = await fetch(`/api/admin/courses/${courseId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: course.title,
        description: course.description,
        published: course.published,
        scope: courseScope,
      }),
    });

    const data = await response.json();
    setMessage(response.ok ? "Course scope updated." : data.error ?? "Failed to update course scope.");
    if (response.ok) router.refresh();
  }

  async function createModule() {
    const title = newModuleTitle.trim();
    if (!title) {
      setMessage("Module title is required.");
      return;
    }

    const response = await fetch(`/api/admin/courses/${courseId}/modules`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        descriptor: newModuleDescriptor || null,
        thumbnailUrl: newModuleThumbnailUrl || null,
        sortOrder: modules.length,
      }),
    });
    const data = await response.json();
    setMessage(response.ok ? "Module created." : data.error ?? "Failed to create module.");
    if (response.ok) {
      setNewModuleTitle("");
      setNewModuleDescriptor("");
      setNewModuleThumbnailUrl("");
      router.refresh();
    }
  }

  async function saveModule(moduleId: string, sortOrder: number) {
    const draft = moduleDrafts[moduleId];
    const title = draft?.title.trim();

    if (!title) {
      setMessage("Module title is required.");
      return;
    }

    const response = await fetch(`/api/admin/modules/${moduleId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        descriptor: draft.descriptor || null,
        thumbnailUrl: draft.thumbnailUrl || null,
        sortOrder,
      }),
    });

    const data = await response.json();
    setMessage(response.ok ? "Module updated." : data.error ?? "Failed to update module.");
    if (response.ok) router.refresh();
  }

  async function deleteModule(moduleId: string) {
    const response = await fetch(`/api/admin/modules/${moduleId}`, { method: "DELETE" });
    const data = await response.json();
    setMessage(response.ok ? "Module deleted." : data.error ?? "Failed to delete module.");
    if (response.ok) router.refresh();
  }

  async function createLesson(moduleId: string) {
    const selectedModule = modules.find((candidate) => candidate.id === moduleId);

    const response = await fetch(`/api/admin/modules/${moduleId}/lessons`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "New lesson",
        descriptor: null,
        thumbnailUrl: null,
        youtubeVideoId: "dQw4w9WgXcQ",
        sortOrder: selectedModule?.lessons.length ?? 0,
        passingScore: 80,
      }),
    });

    const data = await response.json();
    setMessage(response.ok ? "Lesson created." : data.error ?? "Failed to create lesson.");
    if (response.ok) router.refresh();
  }

  async function saveLesson(lessonId: string, sortOrder: number) {
    const draft = lessonDrafts[lessonId];
    const title = draft?.title.trim();

    if (!title) {
      setMessage("Lesson title is required.");
      return;
    }

    const parsedScore = Number.parseInt(draft.passingScore, 10);
    const passingScore = Number.isFinite(parsedScore) ? Math.min(100, Math.max(0, parsedScore)) : 80;

    const response = await fetch(`/api/admin/lessons/${lessonId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        descriptor: draft.descriptor || null,
        thumbnailUrl: draft.thumbnailUrl || null,
        youtubeVideoId: draft.youtubeVideoId,
        sortOrder,
        passingScore,
      }),
    });

    const data = await response.json();
    setMessage(response.ok ? "Lesson updated." : data.error ?? "Failed to update lesson.");
    if (response.ok) router.refresh();
  }

  async function deleteLesson(lessonId: string) {
    const response = await fetch(`/api/admin/lessons/${lessonId}`, { method: "DELETE" });
    const data = await response.json();
    setMessage(response.ok ? "Lesson deleted." : data.error ?? "Failed to delete lesson.");
    if (response.ok) router.refresh();
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Course settings</CardTitle>
          <CardDescription>Set visibility scope for this course.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-[220px_auto]">
          <Select onChange={(e) => setCourseScope(e.target.value as "DIOCESE" | "PARISH")} value={courseScope}>
            <option value="DIOCESE">DIOCESE</option>
            <option value="PARISH">PARISH</option>
          </Select>
          <div>
            <Button onClick={saveCourseScope} type="button" variant="secondary">
              Save course settings
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Create module</CardTitle>
          <CardDescription>Add a new module card with descriptor and thumbnail metadata.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <Input onChange={(e) => setNewModuleTitle(e.target.value)} placeholder="Module title" value={newModuleTitle} />
          <Input
            onChange={(e) => setNewModuleThumbnailUrl(e.target.value)}
            placeholder="Thumbnail URL (optional)"
            value={newModuleThumbnailUrl}
          />
          <Input
            accept={SUPPORTED_IMAGE_TYPES.join(",")}
            disabled={uploadingTarget === "new-module-thumbnail"}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (!file) return;

              void uploadThumbnailImage({
                file,
                kind: "module",
                targetId: "new-module-thumbnail",
                onUploaded: (url) => setNewModuleThumbnailUrl(url),
              });
            }}
            type="file"
          />
          <Textarea
            className="md:col-span-2"
            onChange={(e) => setNewModuleDescriptor(e.target.value)}
            placeholder="Module descriptor (optional)"
            value={newModuleDescriptor}
          />
          <div>
            <Button onClick={createModule} type="button">
              Add module
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {modules.map((module, moduleIndex) => {
          const moduleDraft = moduleDrafts[module.id] ?? {
            title: module.title,
            descriptor: module.descriptor ?? "",
            thumbnailUrl: module.thumbnail_url ?? "",
          };

          return (
            <Card key={module.id}>
              <CardHeader>
                <CardTitle>Module {moduleIndex + 1}</CardTitle>
                <CardDescription>Each lesson appears as a card under this module.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <Input
                    onChange={(event) =>
                      setModuleDrafts((prev) => ({
                        ...prev,
                        [module.id]: { ...moduleDraft, title: event.target.value },
                      }))
                    }
                    placeholder="Module title"
                    value={moduleDraft.title}
                  />
                  <Input
                    onChange={(event) =>
                      setModuleDrafts((prev) => ({
                        ...prev,
                        [module.id]: { ...moduleDraft, thumbnailUrl: event.target.value },
                      }))
                    }
                    placeholder="Thumbnail URL (optional)"
                    value={moduleDraft.thumbnailUrl}
                  />
                  <Input
                    accept={SUPPORTED_IMAGE_TYPES.join(",")}
                    disabled={uploadingTarget === `module-thumbnail:${module.id}`}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.target.value = "";
                      if (!file) return;

                      void uploadThumbnailImage({
                        file,
                        kind: "module",
                        targetId: `module-thumbnail:${module.id}`,
                        onUploaded: (url) =>
                          setModuleDrafts((prev) => ({
                            ...prev,
                            [module.id]: {
                              ...(prev[module.id] ?? {
                                title: module.title,
                                descriptor: module.descriptor ?? "",
                                thumbnailUrl: module.thumbnail_url ?? "",
                              }),
                              thumbnailUrl: url,
                            },
                          })),
                      });
                    }}
                    type="file"
                  />
                  <Textarea
                    className="md:col-span-2"
                    onChange={(event) =>
                      setModuleDrafts((prev) => ({
                        ...prev,
                        [module.id]: { ...moduleDraft, descriptor: event.target.value },
                      }))
                    }
                    placeholder="Module descriptor (optional)"
                    value={moduleDraft.descriptor}
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => saveModule(module.id, moduleIndex)} size="sm" type="button" variant="secondary">
                    Save module
                  </Button>
                  <Button onClick={() => createLesson(module.id)} size="sm" type="button" variant="secondary">
                    Add lesson
                  </Button>
                  <Button onClick={() => deleteModule(module.id)} size="sm" type="button" variant="destructive">
                    Delete module
                  </Button>
                </div>

                {module.lessons.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No lessons yet.</p>
                ) : (
                  <div className="space-y-3">
                    {module.lessons.map((lesson, lessonIndex) => {
                      const lessonDraft = lessonDrafts[lesson.id] ?? {
                        title: lesson.title,
                        descriptor: lesson.descriptor ?? "",
                        thumbnailUrl: lesson.thumbnail_url ?? "",
                        youtubeVideoId: lesson.youtube_video_id,
                        passingScore: String(lesson.passing_score),
                      };

                      return (
                        <div className="space-y-3 rounded-md border border-border bg-muted/20 p-4" key={lesson.id}>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-medium">
                              Lesson {lessonIndex + 1} · {lesson.questions.length} question{lesson.questions.length === 1 ? "" : "s"}
                            </p>
                            <Button asChild size="sm" type="button" variant="outline">
                              <Link href={`/app/admin/courses/${courseId}/lessons/${lesson.id}`}>Edit questions</Link>
                            </Button>
                          </div>

                          <div className="grid gap-3 md:grid-cols-2">
                            <Input
                              onChange={(event) =>
                                setLessonDrafts((prev) => ({
                                  ...prev,
                                  [lesson.id]: { ...lessonDraft, title: event.target.value },
                                }))
                              }
                              placeholder="Lesson title"
                              value={lessonDraft.title}
                            />
                            <Input
                              onChange={(event) =>
                                setLessonDrafts((prev) => ({
                                  ...prev,
                                  [lesson.id]: { ...lessonDraft, thumbnailUrl: event.target.value },
                                }))
                              }
                              placeholder="Thumbnail URL (optional)"
                              value={lessonDraft.thumbnailUrl}
                            />
                            <Input
                              accept={SUPPORTED_IMAGE_TYPES.join(",")}
                              disabled={uploadingTarget === `lesson-thumbnail:${lesson.id}`}
                              onChange={(event) => {
                                const file = event.target.files?.[0];
                                event.target.value = "";
                                if (!file) return;

                                void uploadThumbnailImage({
                                  file,
                                  kind: "lesson",
                                  targetId: `lesson-thumbnail:${lesson.id}`,
                                  onUploaded: (url) =>
                                    setLessonDrafts((prev) => ({
                                      ...prev,
                                      [lesson.id]: {
                                        ...(prev[lesson.id] ?? {
                                          title: lesson.title,
                                          descriptor: lesson.descriptor ?? "",
                                          thumbnailUrl: lesson.thumbnail_url ?? "",
                                          youtubeVideoId: lesson.youtube_video_id,
                                          passingScore: String(lesson.passing_score),
                                        }),
                                        thumbnailUrl: url,
                                      },
                                    })),
                                });
                              }}
                              type="file"
                            />
                            <Textarea
                              className="md:col-span-2"
                              onChange={(event) =>
                                setLessonDrafts((prev) => ({
                                  ...prev,
                                  [lesson.id]: { ...lessonDraft, descriptor: event.target.value },
                                }))
                              }
                              placeholder="Lesson descriptor (optional)"
                              value={lessonDraft.descriptor}
                            />
                            <Input
                              onChange={(event) =>
                                setLessonDrafts((prev) => ({
                                  ...prev,
                                  [lesson.id]: { ...lessonDraft, youtubeVideoId: event.target.value },
                                }))
                              }
                              placeholder="YouTube video ID"
                              value={lessonDraft.youtubeVideoId}
                            />
                            <Input
                              max={100}
                              min={0}
                              onChange={(event) =>
                                setLessonDrafts((prev) => ({
                                  ...prev,
                                  [lesson.id]: { ...lessonDraft, passingScore: event.target.value },
                                }))
                              }
                              placeholder="Passing score"
                              type="number"
                              value={lessonDraft.passingScore}
                            />
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <Button onClick={() => saveLesson(lesson.id, lessonIndex)} size="sm" type="button" variant="secondary">
                              Save lesson
                            </Button>
                            <Button onClick={() => deleteLesson(lesson.id)} size="sm" type="button" variant="destructive">
                              Delete lesson
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
    </div>
  );
}
