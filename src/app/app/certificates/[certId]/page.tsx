import { notFound } from "next/navigation";

import { requireParishRole } from "@/lib/authz";
import { listStudentCertificates } from "@/lib/repositories/certificates";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Link from "next/link";

export default async function CertificateDetailPage({
  params,
}: {
  params: Promise<{ certId: string }>;
}) {
  const { certId } = await params;
  const { clerkUserId, parishId } = await requireParishRole("student");

  // Verify ownership
  const certs = await listStudentCertificates(clerkUserId, parishId);
  const cert = certs.find((c) => c.id === certId);
  if (!cert) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{cert.course_title}</h1>
          <p className="text-sm text-muted-foreground">
            Issued {cert.completion_date} · {cert.parish_name}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <a href={`/api/certificates/${certId}/pdf`} target="_blank" rel="noopener noreferrer">
              Download PDF
            </a>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/app/certificates">← All Certificates</Link>
          </Button>
        </div>
      </div>

      {/* Inline PDF preview */}
      <Card className="overflow-hidden">
        <div className="relative" style={{ minHeight: "500px" }}>
          <iframe
            src={`/api/certificates/${certId}/pdf`}
            className="h-[700px] w-full"
            title={`Certificate: ${cert.course_title}`}
          />
        </div>
      </Card>

      <div className="text-center">
        <p className="text-xs text-muted-foreground">
          {cert.lesson_count} lessons completed · Certificate ID: {certId.slice(0, 8).toUpperCase()}
        </p>
      </div>
    </div>
  );
}