import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="text-4xl font-bold">Western Diocese Learning Management System</h1>
      <p className="text-slate-600">
        Multi-tenant LMS organized by parish with video lessons, quizzes, and analytics.
      </p>
      <div className="flex gap-3">
        <Link href="/sign-in">
          <Button>Sign in</Button>
        </Link>
        <Link href="/sign-up">
          <Button variant="outline">Create account</Button>
        </Link>
      </div>
    </main>
  );
}
