"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function PublicLearningHeader({ current }: { current: "catalog" | "course" }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-nav-border bg-nav-bg shadow-sm transition-colors duration-250">
      <div className="mx-auto flex h-[52px] max-w-[1240px] items-center justify-between px-5 sm:px-7">
        <Link aria-label="St. John Learning home" className="flex items-center gap-2" href="/">
          <span className="flex h-[26px] w-[26px] items-center justify-center rounded-[5px] bg-primary">
            <svg aria-hidden="true" viewBox="0 0 20 20" width="14" height="14" xmlns="http://www.w3.org/2000/svg">
              <path d="M10 1v18M1 10h18M6 6l-3-3M14 6l3-3M6 14l-3 3M14 14l3 3" fill="none" stroke="white" strokeLinecap="round" strokeWidth="2" />
            </svg>
          </span>
          <span className="text-[13px] font-bold tracking-tight text-foreground">St. John Learning</span>
        </Link>

        <nav aria-label="Primary navigation" className="hidden items-center gap-1 md:flex">
          <Link
            className={cn(
              "rounded-md px-3.5 py-2 text-[13px] font-semibold transition-colors",
              current === "catalog" ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
            href="/catalog"
          >
            Course catalog
          </Link>
          <Button asChild size="sm" variant="secondary">
            <Link href="/sign-in">Sign in</Link>
          </Button>
        </nav>

        <button
          aria-controls="public-navigation"
          aria-expanded={mobileOpen}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground md:hidden"
          onClick={() => setMobileOpen((open) => !open)}
          type="button"
        >
          {mobileOpen ? <X size={19} /> : <Menu size={20} />}
        </button>
      </div>

      {mobileOpen ? (
        <nav
          aria-label="Mobile navigation"
          className="border-t border-nav-border bg-nav-bg px-5 py-3 md:hidden"
          id="public-navigation"
        >
          <div className="mx-auto flex max-w-[1240px] flex-col gap-1">
            <Link
              className={cn(
                "rounded-md px-3 py-2 text-sm font-semibold transition-colors",
                current === "catalog" ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
              href="/catalog"
              onClick={() => setMobileOpen(false)}
            >
              Course catalog
            </Link>
            <Link
              className="rounded-md px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              href="/sign-in"
              onClick={() => setMobileOpen(false)}
            >
              Sign in
            </Link>
          </div>
        </nav>
      ) : null}
    </header>
  );
}
