"use client";

import { useEffect, useMemo, useState } from "react";

import type { DioceseCourseRow, DioceseParishRow } from "@/lib/repositories/diocese-admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProgressBar } from "@/components/ui/progress-bar";
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
    <div>
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-5 py-3">
        <Select className="h-[34px] w-[160px] text-[13px]" onChange={(e) => setParishId(e.target.value)} value={parishId}>
          <option value="all">All parishes</option>
          {parishes.map((parish) => (
            <option key={parish.id} value={parish.id}>
              {parish.name}
            </option>
          ))}
        </Select>
        <Select className="h-[34px] w-[160px] text-[13px]" onChange={(e) => setCourseId(e.target.value)} value={courseId}>
          <option value="all">All courses</option>
          {courses.map((course) => (
            <option key={course.id} value={course.id}>
              {course.title}
            </option>
          ))}
        </Select>
        <Input
          aria-label="Start date"
          className="h-[34px] w-[140px] text-[13px]"
          onChange={(e) => setStartDate(e.target.value)}
          type="date"
          value={startDate}
        />
        <Input
          aria-label="End date"
          className="h-[34px] w-[140px] text-[13px]"
          onChange={(e) => setEndDate(e.target.value)}
          type="date"
          value={endDate}
        />
        {(startDate || endDate) ? (
          <Button onClick={() => { setStartDate(""); setEndDate(""); }} size="sm" type="button" variant="ghost">
            Clear dates
          </Button>
        ) : null}
        <Button asChild size="sm" type="button" variant="secondary">
          <a href={exportHref}>Export CSV</a>
        </Button>
      </div>

      {/* Engagement table */}
      <table className="w-full text-left">
        <thead>
          <tr>
            <th className="px-3.5 py-2.5 text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground">Parish</th>
            <th className="px-3.5 py-2.5 text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground">Course</th>
            <th className="px-3.5 py-2.5 text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground">Enrolled</th>
            <th className="px-3.5 py-2.5 text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground">Started</th>
            <th className="px-3.5 py-2.5 text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground">Completed</th>
            <th className="px-3.5 py-2.5 text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground">Completion</th>
            <th className="px-3.5 py-2.5 text-right text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground">Details</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr className="border-t border-border hover:bg-secondary" key={`${row.parish_id}-${row.course_id}`}>
              <td className="px-3.5 py-3 text-[13px] font-semibold">{row.parish_name}</td>
              <td className="px-3.5 py-3 text-[13px]">{row.course_title}</td>
              <td className="px-3.5 py-3 text-[13px]">{row.enrollment_count}</td>
              <td className="px-3.5 py-3 text-[13px]">{row.learners_started}</td>
              <td className="px-3.5 py-3 text-[13px]">{row.learners_completed}</td>
              <td className="px-3.5 py-3">
                <div className="flex items-center gap-2">
                  <ProgressBar
                    className="w-16"
                    value={row.completion_rate}
                    variant={row.completion_rate >= 75 ? "success" : row.completion_rate >= 40 ? "default" : "warning"}
                  />
                  <span className="text-[12px] text-muted-foreground">{row.completion_rate}%</span>
                </div>
              </td>
              <td className="px-3.5 py-3 text-right">
                <Button
                  onClick={() => setSelectedPair({ parishId: row.parish_id, courseId: row.course_id })}
                  size="xs"
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

      {/* Footer */}
      <div className="flex items-center justify-between rounded-b-lg border-t border-border bg-secondary px-5 py-3">
        <span className="text-xs text-muted-foreground">
          {rows.length} engagement records
        </span>
      </div>

      {/* Trend history */}
      {(startDate || endDate) && trends.length > 0 ? (
        <div className="mx-5 mt-4 rounded-lg border border-border">
          <div className="border-b border-border px-4 py-3">
            <h3 className="text-[13px] font-bold">Trend history</h3>
          </div>
          <table className="w-full text-left">
            <thead>
              <tr>
                <th className="px-3.5 py-2.5 text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground">Period</th>
                <th className="px-3.5 py-2.5 text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground">Started</th>
                <th className="px-3.5 py-2.5 text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground">Completed</th>
                <th className="px-3.5 py-2.5 text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground">Completion</th>
              </tr>
            </thead>
            <tbody>
              {trends.map((trend) => (
                <tr className="border-t border-border" key={trend.period}>
                  <td className="px-3.5 py-2.5 text-[13px] font-semibold">{trend.period}</td>
                  <td className="px-3.5 py-2.5 text-[13px]">{trend.learners_started}</td>
                  <td className="px-3.5 py-2.5 text-[13px]">{trend.learners_completed}</td>
                  <td className="px-3.5 py-2.5">
                    <div className="flex items-center gap-2">
                      <ProgressBar className="w-16" value={trend.completion_rate} />
                      <span className="text-[12px] text-muted-foreground">{trend.completion_rate}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {(startDate || endDate) && trends.length === 0 ? (
        <p className="px-5 py-3 text-[13px] text-muted-foreground">No trend data found for this date range.</p>
      ) : null}

      {/* Learner drill-down */}
      {selectedPair ? (
        <div className="mx-5 mt-4 rounded-lg border border-border">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h3 className="text-[13px] font-bold">Learner progress drill-down</h3>
            <Button onClick={() => setSelectedPair(null)} size="xs" type="button" variant="ghost">
              Close
            </Button>
          </div>
          <table className="w-full text-left">
            <thead>
              <tr>
                <th className="px-3.5 py-2.5 text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground">User</th>
                <th className="px-3.5 py-2.5 text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground">Enrolled</th>
                <th className="px-3.5 py-2.5 text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground">Lessons</th>
                <th className="px-3.5 py-2.5 text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground">Progress</th>
              </tr>
            </thead>
            <tbody>
              {learners.map((learner) => (
                <tr className="border-t border-border" key={learner.clerk_user_id}>
                  <td className="px-3.5 py-2.5 font-mono text-[12px]">{learner.clerk_user_id}</td>
                  <td className="px-3.5 py-2.5 text-[13px]">{new Date(learner.enrolled_at).toLocaleDateString()}</td>
                  <td className="px-3.5 py-2.5 text-[13px]">
                    {learner.completed_lessons}/{learner.total_lessons}
                  </td>
                  <td className="px-3.5 py-2.5">
                    <div className="flex items-center gap-2">
                      <ProgressBar
                        className="w-20"
                        value={learner.progress_percent}
                        variant={learner.progress_percent === 100 ? "success" : "default"}
                      />
                      <span className="text-[12px] text-muted-foreground">{learner.progress_percent}%</span>
                      {learner.progress_percent === 100 && <Badge variant="success">Done</Badge>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
