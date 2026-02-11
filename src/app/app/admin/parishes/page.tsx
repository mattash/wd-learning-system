import { AdminParishManager } from "@/components/admin-parish-manager";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listParishes } from "@/lib/repositories/diocese-admin";

export default async function DioceseAdminParishesPage() {
  const parishes = await listParishes(100);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Parishes</CardTitle>
        <CardDescription>Create, update, and delete parishes. Manage self-signup policy.</CardDescription>
      </CardHeader>
      <CardContent className="overflow-auto">
        <AdminParishManager parishes={parishes} />
      </CardContent>
    </Card>
  );
}
