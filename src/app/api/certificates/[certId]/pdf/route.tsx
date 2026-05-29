import { renderToBuffer } from "@react-pdf/renderer";
import { NextResponse } from "next/server";

import { requireAuth } from "@/lib/authz";
import { getCertificatePdfData } from "@/lib/repositories/certificates";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { CertificateDocument } from "@/lib/certificates/certificate-pdf";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ certId: string }> },
) {
  const clerkUserId = await requireAuth();
  const { certId } = await params;
  const supabase = getSupabaseAdminClient();

  // Verify the user owns this certificate
  const { data: cert } = await supabase
    .from("certificates")
    .select("id, clerk_user_id, course_id, issued_at")
    .eq("id", certId)
    .single();

  if (!cert || cert.clerk_user_id !== clerkUserId) {
    return NextResponse.json({ error: "Certificate not found" }, { status: 404 });
  }

  const c = cert as { id: string; clerk_user_id: string; course_id: string; issued_at: string };

  // Get full PDF data
  const pdfData = await getCertificatePdfData(certId);
  if (!pdfData) {
    return NextResponse.json({ error: "Could not load certificate data" }, { status: 500 });
  }

  // Get lesson count for this course
  const { data: modules, error: modulesError } = await supabase
    .from("modules")
    .select("id")
    .eq("course_id", c.course_id);
  if (modulesError) {
    return NextResponse.json({ error: "Could not load course lesson count" }, { status: 500 });
  }

  const moduleIds = ((modules ?? []) as Array<{ id: string }>).map((m) => m.id);
  let lessonCount = 0;
  if (moduleIds.length > 0) {
    const { data: lessons, error: lessonsError } = await supabase
      .from("lessons")
      .select("id")
      .in("module_id", moduleIds);
    if (lessonsError) {
      return NextResponse.json({ error: "Could not load course lesson count" }, { status: 500 });
    }
    lessonCount = (lessons ?? []).length;
  }

  const data = { ...pdfData, courseLessonCount: lessonCount };

  // Generate PDF
  const pdfBuffer = await renderToBuffer(<CertificateDocument data={data} />);

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="certificate-${certId}.pdf"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
