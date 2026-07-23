import { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { DioceseAdminNav } from "@/components/diocese-admin-nav";
import { requireDioceseAdmin } from "@/lib/authz";

export const dynamic = "force-dynamic";

export default async function DioceseAdminLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  await requireDioceseAdmin();

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <div className="flex items-center gap-2.5">
          <h1 className="font-display text-[22px] font-bold tracking-tight">System Administration</h1>
          <Badge variant="role">System Admin</Badge>
        </div>
        <p className="text-[13.5px] text-muted-foreground">
          Manage users, parishes, course catalog, and engagement insights across the learning system.
        </p>
        <DioceseAdminNav />
      </header>
      {children}
    </div>
  );
}
