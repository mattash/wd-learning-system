"use client";

import { useMemo, useState } from "react";

import type {
  ParishAdminCohortRow,
  ParishAdminCourseRow,
  ParishAdminMemberRow,
  ParishAdminParticipationRow,
  ParishParticipationStatus,
} from "@/lib/repositories/parish-admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

const STATUS_LABELS: Record<ParishParticipationStatus, string> = {
  not_started: "Not started",
  active: "Active",
  stalled: "Stalled",
  completed: "Completed",
};

function formatDate(value: string | null) {
  if (!value) return "No activity yet";
  return new Date(value).toLocaleDateString();
}

function toLearnerLabel(member: ParishAdminMemberRow | undefined, clerkUserId: string) {
  return member?.display_name ?? member?.email ?? clerkUserId;
}

function buildCommunicationHref({
  audienceType,
  audienceValue,
  subject,
  body,
}: {
  audienceType: "cohort" | "course";
  audienceValue: string;
  subject: string;
  body: string;
}) {
  const params = new URLSearchParams();
  params.set("audienceType", audienceType);
  params.set("audienceValue", audienceValue);
  params.set("subject", subject);
  params.set("body", body);
  return `/app/parish-admin?${params.toString()}#communications`;
}

export function ParishParticipationManager({
  courses,
  cohorts,
  members,
  participationRows,
  canLogCommunications,
}: {
  courses: ParishAdminCourseRow[];
  cohorts: ParishAdminCohortRow[];
  members: ParishAdminMemberRow[];
  participationRows: ParishAdminParticipationRow[];
  canLogCommunications: boolean;
}) {
  const [courseFilter, setCourseFilter] = useState("all");
  const [cohortFilter, setCohortFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<ParishParticipationStatus | "all">("all");
  const [search, setSearch] = useState("");

  const courseTitleById = useMemo(() => new Map(courses.map((course) => [course.id, course.title])), [courses]);
  const cohortNameById = useMemo(() => new Map(cohorts.map((cohort) => [cohort.id, cohort.name])), [cohorts]);
  const memberById = useMemo(() => new Map(members.map((member) => [member.clerk_user_id, member])), [members]);

  const statusCounts = useMemo(() => {
    return participationRows.reduce(
      (acc, row) => {
        acc[row.status] += 1;
        return acc;
      },
      {
        not_started: 0,
        active: 0,
        stalled: 0,
        completed: 0,
      } satisfies Record<ParishParticipationStatus, number>,
    );
  }, [participationRows]);

  const filteredRows = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return participationRows.filter((row) => {
      if (courseFilter !== "all" && row.course_id !== courseFilter) return false;
      if (cohortFilter === "unassigned") {
        if (row.cohort_id) return false;
      } else if (cohortFilter !== "all" && row.cohort_id !== cohortFilter) {
        return false;
      }
      if (statusFilter !== "all" && row.status !== statusFilter) return false;

      if (!normalizedSearch) return true;
      const learnerLabel = toLearnerLabel(memberById.get(row.clerk_user_id), row.clerk_user_id).toLowerCase();
      const courseTitle = (courseTitleById.get(row.course_id) ?? row.course_id).toLowerCase();
      const cohortName = (row.cohort_id ? cohortNameById.get(row.cohort_id) ?? row.cohort_id : "unassigned").toLowerCase();
      const clerkUserId = row.clerk_user_id.toLowerCase();

      return (
        learnerLabel.includes(normalizedSearch) ||
        courseTitle.includes(normalizedSearch) ||
        cohortName.includes(normalizedSearch) ||
        clerkUserId.includes(normalizedSearch)
      );
    });
  }, [cohortFilter, cohortNameById, courseFilter, courseTitleById, memberById, participationRows, search, statusFilter]);

  const hasFilters = Boolean(search.trim()) || courseFilter !== "all" || cohortFilter !== "all" || statusFilter !== "all";
  const exportHref = useMemo(() => {
    const params = new URLSearchParams();
    if (courseFilter !== "all") params.set("courseId", courseFilter);
    if (cohortFilter !== "all") params.set("cohortId", cohortFilter);
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (search.trim()) params.set("search", search.trim());
    const query = params.toString();
    return `/api/parish-admin/participation/export${query ? `?${query}` : ""}`;
  }, [cohortFilter, courseFilter, search, statusFilter]);

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-md border border-border bg-muted p-3">
          <p className="text-xs text-muted-foreground">Stalled</p>
          <p className="text-xl font-semibold">{statusCounts.stalled}</p>
        </div>
        <div className="rounded-md border border-border bg-muted p-3">
          <p className="text-xs text-muted-foreground">Not started</p>
          <p className="text-xl font-semibold">{statusCounts.not_started}</p>
        </div>
        <div className="rounded-md border border-border bg-muted p-3">
          <p className="text-xs text-muted-foreground">Active</p>
          <p className="text-xl font-semibold">{statusCounts.active}</p>
        </div>
        <div className="rounded-md border border-border bg-muted p-3">
          <p className="text-xs text-muted-foreground">Completed</p>
          <p className="text-xl font-semibold">{statusCounts.completed}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select onChange={(e) => setCourseFilter(e.target.value)} value={courseFilter}>
          <option value="all">All courses</option>
          {courses.map((course) => (
            <option key={course.id} value={course.id}>
              {course.title}
            </option>
          ))}
        </Select>

        <Select onChange={(e) => setCohortFilter(e.target.value)} value={cohortFilter}>
          <option value="all">All cohorts</option>
          <option value="unassigned">Unassigned</option>
          {cohorts.map((cohort) => (
            <option key={cohort.id} value={cohort.id}>
              {cohort.name}
            </option>
          ))}
        </Select>

        <Select onChange={(e) => setStatusFilter(e.target.value as ParishParticipationStatus | "all")} value={statusFilter}>
          <option value="all">All statuses</option>
          <option value="stalled">Stalled</option>
          <option value="not_started">Not started</option>
          <option value="active">Active</option>
          <option value="completed">Completed</option>
        </Select>

        <Input
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search learner, course, or cohort"
          value={search}
        />

        {hasFilters ? (
          <Button
            onClick={() => {
              setCourseFilter("all");
              setCohortFilter("all");
              setStatusFilter("all");
              setSearch("");
            }}
            type="button"
            variant="ghost"
          >
            Clear filters
          </Button>
        ) : null}

        <Button asChild type="button" variant="outline">
          <a href={exportHref}>Export CSV</a>
        </Button>
      </div>

      <table className="w-full text-left text-sm">
        <thead className="text-muted-foreground">
          <tr>
            <th className="py-2 pr-4 font-medium">Learner</th>
            <th className="py-2 pr-4 font-medium">Course</th>
            <th className="py-2 pr-4 font-medium">Cohort</th>
            <th className="py-2 pr-4 font-medium">Progress</th>
            <th className="py-2 pr-4 font-medium">Status</th>
            <th className="py-2 pr-4 font-medium">Last activity</th>
            <th className="py-2 pr-4 font-medium">Enrolled</th>
            {canLogCommunications ? <th className="py-2 pr-4 font-medium">Actions</th> : null}
          </tr>
        </thead>
        <tbody>
          {filteredRows.map((row) => (
            <tr className="border-t" key={row.enrollment_id}>
              <td className="py-2 pr-4">
                <p>{toLearnerLabel(memberById.get(row.clerk_user_id), row.clerk_user_id)}</p>
                <p className="text-xs text-muted-foreground">{row.clerk_user_id}</p>
              </td>
              <td className="py-2 pr-4">{courseTitleById.get(row.course_id) ?? row.course_id}</td>
              <td className="py-2 pr-4">{row.cohort_id ? cohortNameById.get(row.cohort_id) ?? row.cohort_id : "Unassigned"}</td>
              <td className="py-2 pr-4">
                {row.completed_lessons}/{row.total_lessons} ({row.progress_percent}%)
              </td>
              <td className="py-2 pr-4">{STATUS_LABELS[row.status]}</td>
              <td className="py-2 pr-4">{formatDate(row.last_activity_at)}</td>
              <td className="py-2 pr-4">{new Date(row.enrolled_at).toLocaleDateString()}</td>
              {canLogCommunications ? (
                <td className="py-2 pr-4">
                  <div className="flex flex-wrap gap-2">
                    {row.cohort_id ? (
                      <Button asChild size="sm" type="button" variant="secondary">
                        <a
                          href={buildCommunicationHref({
                            audienceType: "cohort",
                            audienceValue: row.cohort_id,
                            subject:
                              row.status === "stalled"
                                ? "Cohort progress follow-up"
                                : "Cohort encouragement message",
                            body:
                              row.status === "stalled"
                                ? "We have noticed some stalled progress in this cohort. Please complete your next lesson this week."
                                : "Keep going this week. Please continue with your next lesson and stay on cadence.",
                          })}
                        >
                          Message cohort
                        </a>
                      </Button>
                    ) : null}
                    <Button asChild size="sm" type="button" variant="outline">
                      <a
                        href={buildCommunicationHref({
                          audienceType: "course",
                          audienceValue: row.course_id,
                          subject:
                            row.status === "not_started"
                              ? "Welcome reminder to start this course"
                              : "Course progress check-in",
                          body:
                            row.status === "not_started"
                              ? "Welcome to this course. Please begin your first lesson this week."
                              : "Friendly reminder to continue your course progress this week.",
                        })}
                      >
                        Message course
                      </a>
                    </Button>
                  </div>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>

      {filteredRows.length === 0 ? <p className="text-sm text-muted-foreground">No learners match current filters.</p> : null}
    </div>
  );
}
