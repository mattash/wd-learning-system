import { AdminMembershipForm } from "@/components/admin-membership-form";
import { requireDioceseAdmin } from "@/lib/authz";

export default async function MembershipToolsPage() {
  await requireDioceseAdmin();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Membership Admin Tool</h1>
      <p className="text-sm text-slate-600">Assign parish memberships and/or promote a user to diocese admin.</p>
      <AdminMembershipForm />
    </div>
  );
}
