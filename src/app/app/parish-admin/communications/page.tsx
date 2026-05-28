import { ParishCommunicationsManager } from "@/components/parish-communications-manager";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireParishRole } from "@/lib/authz";
import { getParishAdminDashboardDataForUser } from "@/lib/repositories/parish-admin";

export default async function CommunicationsPage() {
  const { parishId, role, clerkUserId } = await requireParishRole("parish_admin");

  if (role !== "parish_admin") {
    return null;
  }

  const data = await getParishAdminDashboardDataForUser({ parishId, role, clerkUserId });

  // Communications page doesn't use prefill from search params in this tabbed version
  const prefill = { audienceType: null, audienceValue: null, subject: null, body: null };

  return (
    <Card id="communications-section">
      <CardHeader>
        <CardTitle>Communications</CardTitle>
        <CardDescription>
          Log nudges and announcements by audience while delivery integration is still pending.
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-auto">
        <ParishCommunicationsManager
          cohorts={data.cohorts}
          courses={data.visibleCourses}
          prefill={prefill}
          sends={data.communicationSends}
        />
      </CardContent>
    </Card>
  );
}
