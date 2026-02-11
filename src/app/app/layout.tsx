import Link from "next/link";
import { UserButton } from "@clerk/nextjs";

import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { requireAuth } from "@/lib/authz";

const navItems = [
  { label: "Courses", href: "/app/courses" },
  { label: "Select Parish", href: "/app/select-parish?manage=1" },
  { label: "Parish Admin", href: "/app/parish-admin" },
  { label: "Diocese Admin", href: "/app/admin" },
];

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAuth();

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
            <UserButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-6">{children}</main>
    </div>
  );
}
