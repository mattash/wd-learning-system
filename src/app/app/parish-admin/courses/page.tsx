import { ParishCourseAdoptionManager } from "@/components/parish-course-adoption-manager";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireParishRole } from "@/lib/authz";
import { getParishAdminDashboardDataForUser } from "@/lib/repositories/parish-admin";

export default async function CoursesPage() {
  const { parishId, role, clerkUserId } = await requireParishRole("parish_admin");

  if (role !== "parish_admin") {
    return null;
  }

  const data = await getParishAdminDashboardDataForUser({ parishId, role, clerkUserId });

  return (
    <Card id="courses-section">
      <CardHeader>
        <CardTitle>Adopt Parish Courses</CardTitle>
        <CardDescription>
          Parish-scoped courses require explicit adoption before they can be assigned to parishioners.
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-auto">
        <ParishCourseAdoptionManager
          adoptedCourses={data.adoptedParishCourses}
          availableCourses={data.availableParishCourses}
        />
      </CardContent>
    </Card>
  );
}
