import { requireParishRole } from "@/lib/authz";
import { getParishJoinRequests } from "@/lib/repositories/course-join-requests";
import { ParishJoinRequestsManager } from "@/components/parish-join-requests-manager";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function JoinRequestsPage() {
  const { parishId, role } = await requireParishRole("parish_admin");

  if (role !== "parish_admin") {
    return null;
  }

  const requests = await getParishJoinRequests(parishId);

  return (
    <Card id="join-requests-section">
      <CardHeader>
        <CardTitle>Course Join Requests</CardTitle>
        <CardDescription>
          Students can request to join courses they are not enrolled in. Review and approve
          or reject these requests to create enrollments.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ParishJoinRequestsManager initialRequests={requests} />
      </CardContent>
    </Card>
  );
}