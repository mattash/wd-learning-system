import { AdminParishManager } from "@/components/admin-parish-manager";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listParishes } from "@/lib/repositories/diocese-admin";

export default async function DioceseAdminParishesPage() {
  const parishes = await listParishes(100);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Parishes</CardTitle>
        <CardDescription>Parishes registered in the diocese. Each parish can adopt diocese-published courses.</CardDescription>
      </CardHeader>
      <div className="overflow-auto">
        <AdminParishManager parishes={parishes} />
      </div>
    </Card>
  );
}
