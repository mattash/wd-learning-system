import { SignUp } from "@clerk/nextjs";

function getEnrollCourseId(params: Record<string, string | string[] | undefined>) {
  const raw = params.enrollCourseId;
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : null;
}

export default async function SignUpPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const enrollCourseId = getEnrollCourseId((await searchParams) ?? {});
  const forceRedirectUrl = enrollCourseId
    ? `/app/onboarding?enrollCourseId=${encodeURIComponent(enrollCourseId)}`
    : "/app";

  return (
    <div className="flex min-h-screen items-center justify-center">
      <SignUp forceRedirectUrl={forceRedirectUrl} />
    </div>
  );
}
