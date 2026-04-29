"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const tabs = [
  { href: "/app/parish-admin", label: "Overview", exact: true },
  { href: "/app/parish-admin/participation", label: "Participation Watchlist" },
  { href: "/app/parish-admin/cohorts", label: "Cohorts" },
  { href: "/app/parish-admin/courses", label: "Course Adoption" },
  { href: "/app/parish-admin/enrollments", label: "Enrollment Management" },
  { href: "/app/parish-admin/join-requests", label: "Join Requests" },
  { href: "/app/parish-admin/communications", label: "Communications" },
  { href: "/app/parish-admin/people", label: "People" },
];

export function ParishAdminNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Parish admin sections" className="flex flex-wrap gap-1.5">
      {tabs.map((tab) => {
        const isActive = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "inline-flex items-center justify-center whitespace-nowrap rounded-full border-[1.5px] px-4 py-1.5 text-[13px] font-medium transition-all",
              isActive
                ? "border-primary bg-primary text-primary-foreground font-bold"
                : "border-border bg-card text-muted-foreground hover:border-brand-muted hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}