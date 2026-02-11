import Link from "next/link";
import { UserButton } from "@clerk/nextjs";

import { requireAuth } from "@/lib/authz";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAuth();

  return (
    <div className="min-h-screen">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <nav className="flex gap-4 text-sm">
            <Link href="/app/courses">Courses</Link>
            <Link href="/app/parish-admin">Parish Admin</Link>
            <Link href="/app/admin">Diocese Admin</Link>
          </nav>
          <UserButton />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-6">{children}</main>
    </div>
  );
}
