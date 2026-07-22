import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { isE2ESmokeMode } from "@/lib/e2e-mode";

const isProtectedRoute = createRouteMatcher(["/app(.*)", "/api(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (isE2ESmokeMode()) {
    return NextResponse.next();
  }

  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)", "/"],
};
