import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export default async function Home() {
  const { userId } = await auth();
  if (userId) {
    redirect("/app/dashboard");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="font-display text-4xl font-bold tracking-tight">St. John Armenian Church Learning System</h1>
      <p className="text-muted-foreground">
        Multi-tenant LMS organized by parish with video lessons, quizzes, and analytics.
      </p>
      <div className="flex gap-3">
        <Button asChild>
          <Link href="/sign-in">Sign in</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/sign-up">Create account</Link>
        </Button>
      </div>
    </main>
  );
}
