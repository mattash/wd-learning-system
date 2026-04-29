import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getDioceseOverview } from "@/lib/repositories/diocese-admin";

const overviewCards = [
  { key: "parishCount", label: "Parishes" },
  { key: "userCount", label: "Users" },
  { key: "dioceseAdminCount", label: "Diocese admins" },
  { key: "courseCount", label: "Courses" },
  { key: "publishedCourseCount", label: "Published courses" },
  { key: "enrollmentCount", label: "Enrollments" },
  { key: "progressRecordCount", label: "Progress records" },
  { key: "completedProgressRecordCount", label: "Completed progress records" },
] as const;

export default async function DioceseAdminPage() {
  const overview = await getDioceseOverview();

  return (
    <div className="space-y-6">
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {overviewCards.map((card) => (
          <div key={card.key} className="rounded-lg border border-border bg-card p-4.5 shadow-sm">
            <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">{card.label}</div>
            <div className="font-display text-[28px] font-bold tracking-tight leading-none">{overview[card.key].toLocaleString()}</div>
          </div>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Diocese management modules</CardTitle>
            <CardDescription>Open focused tools for users, parishes, courses, and engagement.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            <Button asChild variant="secondary">
              <Link href="/app/admin/users">Manage users</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/app/admin/parishes">Manage parishes</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/app/admin/courses">Manage courses</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/app/admin/engagement">View engagement</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/app/admin/audit">View audit logs</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Access and roles</CardTitle>
            <CardDescription>
              Continue using the access tool for assigning parish memberships and diocesan admins.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/app/admin/memberships">Open membership tool</Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
