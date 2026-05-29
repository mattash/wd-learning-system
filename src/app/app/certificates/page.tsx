import Link from "next/link";

import { requireParishRole } from "@/lib/authz";
import { listStudentCertificates } from "@/lib/repositories/certificates";
import { Button } from "@/components/ui/button";
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
                  <Button asChild className="flex-1" size="sm">
                    <Link href={`/app/certificates/${cert.id}`}>
                      View Certificate
                    </Link>
                  </Button>
                  <Button asChild className="flex-shrink-0" variant="outline" size="sm">
                    <a
                      href={`/api/certificates/${cert.id}/pdf`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      ↓ PDF
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
