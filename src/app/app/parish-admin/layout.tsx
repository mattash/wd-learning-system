import { ParishAdminNav } from "@/components/parish-admin-nav";
import { requireParishRole } from "@/lib/authz";
import { getParishAdminDashboardDataForUser } from "@/lib/repositories/parish-admin";

export default async function ParishAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6" id="top">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="font-display text-[22px] font-bold tracking-tight">Parish Admin Dashboard</h1>
        </div>
        <ParishAdminNav />
      </header>
      {children}
    </div>
  );
}

export async function getParishAdminData() {
  return requireParishRole("instructor").then(({ parishId, role, clerkUserId }) =>
    getParishAdminDashboardDataForUser({ parishId, role, clerkUserId }),
  );
}

export function getRoleLabel(role: string) {
  return role === "parish_admin" ? "Parish Admin" : "Facilitator";
}

export function getRoleDescription(role: string) {
  return role === "parish_admin"
    ? "Adopt parish-scoped courses, manage learner enrollments, and monitor current participation."
    : "Manage assigned cohorts and monitor participation for your learners.";
}