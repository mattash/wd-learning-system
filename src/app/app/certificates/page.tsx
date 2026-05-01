import Link from "next/link";

import { requireParishRole } from "@/lib/authz";
import { listStudentCertificates } from "@/lib/repositories/certificates";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function CertificatesPage() {
  const { clerkUserId, parishId } = await requireParishRole("student");
  const certs = await listStudentCertificates(clerkUserId, parishId);

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">My Certificates</h1>
        <p className="text-sm text-muted-foreground">
          Download and print your course completion certificates.
        </p>
      </header>

      {certs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="mb-4 text-5xl">📜</div>
            <p className="mb-1 font-medium">No certificates yet</p>
            <p className="text-sm text-muted-foreground">
              Complete all lessons in a course to earn your first certificate.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {certs.map((cert) => (
            <Card key={cert.id} className="hover:bg-secondary/50 transition-colors">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{cert.course_title}</CardTitle>
                <p className="text-xs text-muted-foreground">{cert.parish_name}</p>
              </CardHeader>
              <CardContent>
                <p className="mb-3 text-xs text-muted-foreground">
                  Issued {cert.completion_date}
                </p>
                <div className="flex gap-2">
                  <Link
                    className="flex-1"
                    href={`/app/certificates/${cert.id}`}
                  >
                    <button
                      className="w-full rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                      type="button"
                    >
                      View Certificate
                    </button>
                  </Link>
                  <a
                    className="flex-shrink-0"
                    href={`/api/certificates/${cert.id}/pdf`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <button
                      className="rounded-md border border-border px-3 py-2 text-xs font-medium text-foreground hover:bg-secondary"
                      type="button"
                    >
                      ↓ PDF
                    </button>
                  </a>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}