import Link from "next/link";

import { Button } from "@/components/ui/button";

const routes = [
  { href: "/app/admin", label: "Overview" },
  { href: "/app/admin/users", label: "Users" },
  { href: "/app/admin/parishes", label: "Parishes" },
  { href: "/app/admin/courses", label: "Courses" },
  { href: "/app/admin/engagement", label: "Engagement" },
  { href: "/app/admin/memberships", label: "Access tool" },
];

export function DioceseAdminNav() {
  return (
    <nav aria-label="Diocese admin sections" className="flex flex-wrap gap-2">
      {routes.map((route) => (
        <Button asChild key={route.href} size="sm" variant="outline">
          <Link href={route.href}>{route.label}</Link>
        </Button>
      ))}
    </nav>
  );
}
