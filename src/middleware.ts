import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { isE2EAuthBypass } from "@/lib/e2e-mode";

const isProtectedRoute = createRouteMatcher(["/app(.*)", "/api(.*)"]);
const isDeliveryWorkerRoute = createRouteMatcher([
  "/api/internal/parish-admin/communications/deliver",
]);

export default clerkMiddleware(async (auth, req) => {
  if (isE2EAuthBypass()) {
    return NextResponse.next();
  }

  // This endpoint authenticates with a dedicated bearer secret so Vercel Cron
  // and recovery workers can reach it without a Clerk browser session.
  if (!isDeliveryWorkerRoute(req) && isProtectedRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)", "/"],
};
