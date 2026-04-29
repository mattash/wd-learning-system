"use client";

import Link from "next/link";
import { useState } from "react";

import { cn } from "@/lib/utils";

const sections = [
  { href: "#top", label: "Overview", targetId: "top" },
  { href: "#courses-section", label: "Course Adoption", targetId: "courses-section" },
  { href: "#participation-section", label: "Participation Watchlist", targetId: "participation-section" },
  { href: "#cohorts-section", label: "Cohorts", targetId: "cohorts-section" },
  { href: "#enrollment-section", label: "Enrollment Management", targetId: "enrollment-section" },
  { href: "#communications-section", label: "Communications", targetId: "communications-section" },
  { href: "#people-section", label: "People", targetId: "people-section" },
];

export function ParishAdminNav() {
  const [activeSection, setActiveSection] = useState("top");

  function scrollToSection(targetId: string) {
    setActiveSection(targetId);
    const element = document.getElementById(targetId);
    if (!element) return;

    element.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <nav aria-label="Parish admin sections" className="flex flex-wrap gap-1.5">
      {sections.map((section) => {
        const isActive = activeSection === section.targetId;

        return (
          <Link
            key={section.href}
            href={section.href}
            onClick={(event) => {
              event.preventDefault();
              scrollToSection(section.targetId);
            }}
            className={cn(
              "inline-flex items-center justify-center whitespace-nowrap rounded-full border-[1.5px] px-4 py-1.5 text-[13px] font-medium transition-all",
              isActive
                ? "border-primary bg-primary text-primary-foreground font-bold"
                : "border-border bg-card text-muted-foreground hover:border-brand-muted hover:text-foreground",
            )}
          >
            {section.label}
          </Link>
        );
      })}
    </nav>
  );
}
