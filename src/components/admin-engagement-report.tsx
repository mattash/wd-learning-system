"use client";

import { useEffect, useMemo, useState } from "react";

import type { DioceseCourseRow, DioceseParishRow } from "@/lib/repositories/diocese-admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

interface EngagementRow {
  parish_id: string;
  course_id: string;
  parish_name: string;
  course_title: string;
  enrollment_count: number;
  learners_started: number;
  learners_completed: number;
  completion_rate: number;
}

interface LearnerRow {
  clerk_user_id: string;
  enrolled_at: string;
  completed_lessons: number;
  total_lessons: number;
  progress_percent: number;
}

interface TrendRow {
  period: string;
  learners_started: number;
  learners_completed: number;
  completion_rate: number;
}

export function AdminEngagementReport({ parishes, courses }: { parishes: DioceseParishRow[]; courses: DioceseCourseRow[] }) {
  const [parishId, setParishId] = useState("all");
  const [courseId, setCourseId] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [rows, setRows] = useState<EngagementRow[]>([]);
  const [trends, setTrends] = useState<TrendRow[]>([]);
  const [learners, setLearners] = useState<LearnerRow[]>([]);
  const [selectedPair, setSelectedPair] = useState<{ parishId: string; courseId: string } | null>(null);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (parishId !== "all") params.set("parishId", parishId);
    if (courseId !== "all") params.set("courseId", courseId);
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    return params.toString();
  }, [courseId, endDate, parishId, startDate]);

  useEffect(() => {
    let cancelled = false;

    async function loadRows() {
      const response = await fetch(`/api/admin/reports/engagement${query ? `?${query}` : ""}`);
      const data = await response.json();
      if (!cancelled && response.ok) {
        setRows(data.rows ?? []);
        setTrends(data.trends ?? []);
      }
    }

    void loadRows();
    return () => {
      cancelled = true;
    };
  }, [query]);

  useEffect(() => {
    let cancelled = false;

    async function loadLearners() {
      if (!selectedPair) {
        setLearners([]);
        return;
      }

      const params = new URLSearchParams({
        parishId: selectedPair.parishId,
        courseId: selectedPair.courseId,
      });
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      const response = await fetch(`/api/admin/reports/engagement/learners?${params.toString()}`);
      const data = await response.json();
      if (!cancelled && response.ok) {
        setLearners(data.learners ?? []);
      }
    }

    void loadLearners();
    return () => {
      cancelled = true;
    };
  }, [endDate, selectedPair, startDate]);

  const exportHref = `/api/admin/reports/engagement/export${query ? `?${query}` : ""}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select onChange={(e) => setParishId(e.target.value)} value={parishId}>
          <option value="all">All parishes</option>
          {parishes.map((parish) => (
            <option key={parish.id} value={parish.id}>
              {parish.name}
            </option>
          ))}
        </Select>

        <Select onChange={(e) => setCourseId(e.target.value)} value={courseId}>
          <option value="all">All courses</option>
          {courses.map((course) => (
            <option key={course.id} value={course.id}>
              {course.title}
            </option>
          ))}
        </Select>

        <Input
          aria-label="Start date"
          onChange={(e) => setStartDate(e.target.value)}
          type="date"
          value={startDate}
        />
        <Input aria-label="End date" onChange={(e) => setEndDate(e.target.value)} type="date" value={endDate} />

        {(startDate || endDate) ? (
          <Button onClick={() => { setStartDate(""); setEndDate(""); }} type="button" variant="ghost">
            Clear dates
          </Button>
        ) : null}

        <Button asChild type="button" variant="outline">
          <a href={exportHref}>Export CSV</a>
        </Button>
      </div>

      <table className="w-full text-left text-sm">
        <thead className="text-muted-foreground">
          <tr>
            <th className="py-2 pr-4 font-medium">Parish</th>
            <th className="py-2 pr-4 font-medium">Course</th>
            <th className="py-2 pr-4 font-medium">Enrolled</th>
            <th className="py-2 pr-4 font-medium">Started</th>
            <th className="py-2 pr-4 font-medium">Completed</th>
            <th className="py-2 pr-4 font-medium">Completion rate</th>
            <th className="py-2 pr-4 font-medium">Drill-down</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr className="border-t" key={`${row.parish_id}-${row.course_id}`}>
              <td className="py-2 pr-4">{row.parish_name}</td>
              <td className="py-2 pr-4">{row.course_title}</td>
              <td className="py-2 pr-4">{row.enrollment_count}</td>
              <td className="py-2 pr-4">{row.learners_started}</td>
              <td className="py-2 pr-4">{row.learners_completed}</td>
              <td className="py-2 pr-4">{row.completion_rate}%</td>
              <td className="py-2 pr-4">
                <Button
                  onClick={() => setSelectedPair({ parishId: row.parish_id, courseId: row.course_id })}
                  size="sm"
                  type="button"
                  variant="secondary"
                >
                  View learners
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {(startDate || endDate) ? (
        <div className="space-y-2 rounded-md border border-border p-3">
          <h3 className="text-sm font-medium">Trend history</h3>
          {trends.length > 0 ? (
            <table className="w-full text-left text-sm">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="py-2 pr-4 font-medium">Period (YYYY-MM)</th>
                  <th className="py-2 pr-4 font-medium">Started</th>
                  <th className="py-2 pr-4 font-medium">Completed</th>
                  <th className="py-2 pr-4 font-medium">Completion rate</th>
                </tr>
              </thead>
              <tbody>
                {trends.map((trend) => (
                  <tr className="border-t" key={trend.period}>
                    <td className="py-2 pr-4">{trend.period}</td>
                    <td className="py-2 pr-4">{trend.learners_started}</td>
                    <td className="py-2 pr-4">{trend.learners_completed}</td>
                    <td className="py-2 pr-4">{trend.completion_rate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-muted-foreground">No trend data found for this date range.</p>
          )}
        </div>
      ) : null}

      {selectedPair ? (
        <div className="space-y-2 rounded-md border border-border p-3">
          <h3 className="text-sm font-medium">Learner progress drill-down</h3>
          <table className="w-full text-left text-sm">
            <thead className="text-muted-foreground">
              <tr>
                <th className="py-2 pr-4 font-medium">User</th>
                <th className="py-2 pr-4 font-medium">Enrolled</th>
                <th className="py-2 pr-4 font-medium">Completed lessons</th>
                <th className="py-2 pr-4 font-medium">Total lessons</th>
                <th className="py-2 pr-4 font-medium">Progress</th>
              </tr>
            </thead>
            <tbody>
              {learners.map((learner) => (
                <tr className="border-t" key={learner.clerk_user_id}>
                  <td className="py-2 pr-4 font-mono text-xs">{learner.clerk_user_id}</td>
                  <td className="py-2 pr-4">{new Date(learner.enrolled_at).toLocaleDateString()}</td>
                  <td className="py-2 pr-4">{learner.completed_lessons}</td>
                  <td className="py-2 pr-4">{learner.total_lessons}</td>
                  <td className="py-2 pr-4">{learner.progress_percent}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
