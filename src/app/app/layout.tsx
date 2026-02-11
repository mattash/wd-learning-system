import Link from "next/link";
import { UserButton } from "@clerk/nextjs";

import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { isE2ESmokeMode } from "@/lib/e2e-mode";
import { hasActiveParishRole, isDioceseAdmin, requireAuth } from "@/lib/authz";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const clerkUserId = await requireAuth();
  const showDioceseAdmin = await isDioceseAdmin(clerkUserId);
  const showParishAdmin = await hasActiveParishRole("instructor", clerkUserId);
  const showUserButton = !isE2ESmokeMode() && Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
  const navItems = [
    { label: "Courses", href: "/app/courses" },
    { label: "Select Parish", href: "/app/select-parish?manage=1" },
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
            <ThemeToggle />
            {showUserButton ? <UserButton /> : null}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-6">{children}</main>
    </div>
  );
}
