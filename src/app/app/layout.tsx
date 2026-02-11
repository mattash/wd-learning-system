import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { cookies } from "next/headers";

import { ParishSwitcher } from "@/components/parish-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { E2E_PARISHES } from "@/lib/e2e-fixtures";
import { isE2ESmokeMode } from "@/lib/e2e-mode";
import { hasActiveParishRole, isDioceseAdmin, requireAuth } from "@/lib/authz";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const clerkUserId = await requireAuth();
  const showDioceseAdmin = await isDioceseAdmin(clerkUserId);
  const showParishAdmin = await hasActiveParishRole("instructor", clerkUserId);
  const showUserButton = !isE2ESmokeMode() && Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
  const store = await cookies();
  const cookieParishId = store.get("active_parish_id")?.value;

  let parishOptions: Array<{ id: string; name: string; slug: string }> = [];
  if (isE2ESmokeMode()) {
    parishOptions = [...E2E_PARISHES];
  } else {
    const supabase = getSupabaseAdminClient();
    const { data } = await supabase
      .from("parish_memberships")
      .select("parishes(id,name,slug)")
      .eq("clerk_user_id", clerkUserId);

    const seen = new Set<string>();
    const normalizedRows =
      ((data ?? []) as Array<{ parishes: { id: string; name: string; slug: string } | null }>) ?? [];
    parishOptions = [];

    for (const row of normalizedRows) {
      const parish = row.parishes;
      if (!parish || seen.has(parish.id)) continue;
      seen.add(parish.id);
      parishOptions.push(parish);
    }

    parishOptions.sort((a, b) => a.name.localeCompare(b.name));
  }

  const activeParishId =
    cookieParishId && parishOptions.some((parish) => parish.id === cookieParishId)
      ? cookieParishId
      : parishOptions[0]?.id;

  const navItems = [
    { label: "Courses", href: "/app/courses" },
    ...(showParishAdmin ? [{ label: "Parish Admin", href: "/app/parish-admin" }] : []),
    ...(showDioceseAdmin ? [{ label: "Diocese Admin", href: "/app/admin" }] : []),
  ];

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <nav className="flex flex-wrap items-center gap-1">
            {navItems.map((item) => (
              <Button
                asChild
                className="text-muted-foreground hover:text-foreground"
                key={item.href}
                size="sm"
                variant="ghost"
              >
                <Link href={item.href}>{item.label}</Link>
              </Button>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            {parishOptions.length > 1 && activeParishId ? (
              <ParishSwitcher activeParishId={activeParishId} parishes={parishOptions} />
            ) : null}
            <ThemeToggle />
            {showUserButton ? <UserButton /> : null}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-6">{children}</main>
    </div>
  );
}
