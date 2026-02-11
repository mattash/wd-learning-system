import { ReactNode } from "react";

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
        <h1 className="text-2xl font-semibold">Diocese Admin</h1>
        <p className="text-sm text-muted-foreground">
          Manage users, parishes, course catalog, and engagement insights across the diocese.
        </p>
        <DioceseAdminNav />
      </header>
      {children}
    </div>
  );
}
