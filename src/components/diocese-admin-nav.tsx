"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const routes = [
  { href: "/app/admin", label: "Overview", exact: true },
  { href: "/app/admin/users", label: "Users" },
  { href: "/app/admin/parishes", label: "Parishes" },
  { href: "/app/admin/courses", label: "Courses" },
  { href: "/app/admin/engagement", label: "Engagement" },
  { href: "/app/admin/audit", label: "Audit logs" },
  { href: "/app/admin/memberships", label: "Access tool" },
];

export function DioceseAdminNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Diocese admin sections" className="flex flex-wrap gap-1.5">
      {routes.map((route) => {
        const isActive = route.exact
          ? pathname === route.href
          : pathname.startsWith(route.href);

        return (
          <Link
            key={route.href}
            href={route.href}
            className={cn(
              "inline-flex items-center justify-center whitespace-nowrap rounded-full border-[1.5px] px-4 py-1.5 text-[13px] font-medium transition-all",
              isActive
                ? "border-primary bg-primary text-primary-foreground font-bold"
                : "border-border bg-card text-muted-foreground hover:border-brand-muted hover:text-foreground",
            )}
          >
            {route.label}
          </Link>
        );
      })}
    </nav>
  );
}
