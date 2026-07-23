import { AdminParishManager } from "@/components/admin-parish-manager";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireDioceseAdmin } from "@/lib/authz";
import { listParishes } from "@/lib/repositories/diocese-admin";

const PARISH_PAGE_SIZE = 100;

export default async function DioceseAdminParishesPage() {
  await requireDioceseAdmin();

  const parishRows = await listParishes(PARISH_PAGE_SIZE + 1);
  const hasMoreParishes = parishRows.length > PARISH_PAGE_SIZE;
  const parishes = parishRows.slice(0, PARISH_PAGE_SIZE);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Parishes</CardTitle>
        <CardDescription>Parishes registered in the learning system. Each parish can adopt shared courses.</CardDescription>
        {hasMoreParishes ? (
          <p className="text-sm text-muted-foreground">
            Showing the first {PARISH_PAGE_SIZE} parishes. Additional parishes are registered and are not shown in this
            view yet.
          </p>
        ) : null}
      </CardHeader>
      <div className="overflow-auto">
        <AdminParishManager parishes={parishes} />
      </div>
    </Card>
  );
}
