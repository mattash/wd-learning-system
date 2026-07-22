import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { requireDioceseAdmin } from "@/lib/authz";
import { getDioceseOverview } from "@/lib/repositories/diocese-admin";

const statRow1 = [
  { key: "parishCount", label: "Parishes" },
  { key: "userCount", label: "Users" },
  { key: "dioceseAdminCount", label: "System Admins" },
  { key: "courseCount", label: "Courses" },
] as const;



const moduleLinks = [
  { href: "/app/admin/users", label: "Manage users" },
  { href: "/app/admin/parishes", label: "Manage parishes" },
  { href: "/app/admin/courses", label: "Manage courses" },
  { href: "/app/admin/engagement", label: "View engagement" },
];

function StatCard({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-sm transition-colors">
      <div className="text-[10.5px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">
        {label}
      </div>
      <div className="font-display text-[30px] font-bold tracking-tight leading-none">
        {value.toLocaleString()}
      </div>
      {sub && <div className="mt-1.5 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

export default async function DioceseAdminPage() {
  await requireDioceseAdmin();

  const overview = await getDioceseOverview();

  const completionRate =
    overview.progressRecordCount > 0
      ? Math.round((overview.completedProgressRecordCount / overview.progressRecordCount) * 100)
      : 0;

  const draftCount = overview.courseCount - overview.publishedCourseCount;

  return (
    <div className="space-y-5">
      {/* Stats row 1 */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {statRow1.map((s) => (
          <StatCard key={s.key} label={s.label} value={overview[s.key]} />
        ))}
      </section>

      {/* Stats row 2 */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Published Courses"
          value={overview.publishedCourseCount}
          sub={draftCount > 0 ? `${draftCount} draft` : undefined}
        />
        <StatCard label="Enrollments" value={overview.enrollmentCount} />
        <StatCard label="Progress Records" value={overview.progressRecordCount} />
        <StatCard
          label="Completed Records"
          value={overview.completedProgressRecordCount}
          sub={`${completionRate}% completion rate`}
        />
      </section>

      {/* Bottom two-col */}
      <section className="grid gap-4 lg:grid-cols-2">
        {/* Management modules */}
        <Card>
          <CardHeader>
            <CardTitle>Diocese Management Modules</CardTitle>
            <CardDescription>Open focused tools for users, parishes, courses, and engagement.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2.5">
              {moduleLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-md border-[1.5px] border-border bg-secondary px-3.5 py-2.5 text-center text-[13.5px] font-medium text-foreground transition-all hover:border-primary hover:bg-brand-subtle hover:text-primary hover:shadow-sm"
                >
                  {link.label}
                </Link>
              ))}
              <Link
                href="/app/admin/audit"
                className="col-span-2 rounded-md border-[1.5px] border-border bg-secondary px-3.5 py-2.5 text-center text-[13.5px] font-medium text-foreground transition-all hover:border-primary hover:bg-brand-subtle hover:text-primary hover:shadow-sm"
              >
                View audit logs
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Access & roles */}
        <Card>
          <CardHeader>
            <CardTitle>Access &amp; Roles</CardTitle>
            <CardDescription>Assign parish memberships and system administrator roles.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-[13px] leading-relaxed text-muted-foreground">
              Use the Access tool to manage who has access to which parishes and who holds system administrator
              privileges. Changes take effect immediately.
            </p>
            <Button asChild>
              <Link href="/app/admin/memberships">Open access tool &rarr;</Link>
            </Button>
            <div className="my-5 h-px bg-border" />
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-muted-foreground">System admins</span>
                <span className="font-bold">{overview.dioceseAdminCount} assigned</span>
              </div>
              <div className="flex items-center justify-between text-[13px]">
                <span className="text-muted-foreground">Parish memberships</span>
                <span className="font-bold">{overview.parishMembershipCount} active</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
