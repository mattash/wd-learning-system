"use client";

import { useState } from "react";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";

import { ParishSwitcher } from "@/components/parish-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

interface NavItem {
  label: string;
  href: string;
}

interface AppHeaderClientProps {
  navItems: NavItem[];
  showParishSwitcher?: boolean;
  showUserButton?: boolean;
  activeParishId?: string;
  parishes?: Array<{ id: string; name: string; slug: string }>;
}

export function AppHeaderClient({
  navItems,
  showParishSwitcher = false,
  showUserButton = false,
  activeParishId,
  parishes = [],
}: AppHeaderClientProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-nav-border bg-nav-bg shadow-sm transition-colors duration-250">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 h-[52px]">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="flex h-[26px] w-[26px] items-center justify-center rounded-[5px] bg-primary">
            <svg viewBox="0 0 20 20" width="14" height="14" xmlns="http://www.w3.org/2000/svg">
              <path d="M10 1v18M1 10h18M6 6l-3-3M14 6l3-3M6 14l-3 3M14 14l3 3" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none"/>
            </svg>
          </div>
          <span className="text-[13px] font-bold text-foreground tracking-tight hidden sm:block">WD Learning</span>
        </div>

        {/* Desktop nav */}
        <nav className="hidden md:flex flex-wrap items-center gap-0.5">
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

        {/* Right side controls */}
        <div className="ml-auto flex items-center gap-2">
          {showParishSwitcher && activeParishId && parishes.length > 1 && (
            <div className="hidden sm:block">
              <ParishSwitcher activeParishId={activeParishId} parishes={parishes} />
            </div>
          )}
          <ThemeToggle />
          {showUserButton && <UserButton />}
          {/* Mobile hamburger */}
          <button
            className="flex md:hidden h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <svg fill="none" height="20" stroke="currentColor" viewBox="0 0 24 24" width="20">
              <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} />
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex flex-col md:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-foreground/40 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          {/* Menu panel */}
          <div className="fixed inset-y-0 right-0 w-[260px] flex flex-col bg-card shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-4 h-[52px]">
              <span className="text-sm font-bold">Menu</span>
              <button
                className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
                onClick={() => setMobileOpen(false)}
                aria-label="Close menu"
              >
                <svg fill="none" height="18" stroke="currentColor" viewBox="0 0 24 24" width="18">
                  <path d="M6 6l12 12M6 18L18 6" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} />
                </svg>
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto px-3 py-2">
              {navItems.map((item) => (
                <Button
                  asChild
                  className="w-full justify-start text-muted-foreground hover:text-foreground"
                  key={item.href}
                  size="sm"
                  variant="ghost"
                  onClick={() => setMobileOpen(false)}
                >
                  <Link href={item.href}>{item.label}</Link>
                </Button>
              ))}
            </nav>
            {showParishSwitcher && activeParishId && parishes.length > 1 && (
              <div className="border-t border-border p-3">
                <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Parish</p>
                <ParishSwitcher activeParishId={activeParishId} parishes={parishes} />
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}