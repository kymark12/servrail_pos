import { requirePosEntitlement } from "@/lib/entitlement";
import { prisma } from "@/lib/db";
import { StaffManager, type StaffDTO } from "@/components/admin/staff-manager";

export default async function StaffPage() {
  const { business } = await requirePosEntitlement();

  const staff = await prisma.staff.findMany({
    where: { businessId: business.id },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    select: { id: true, name: true, role: true, isActive: true },
  });

  const dto: StaffDTO[] = staff; // pinHash intentionally excluded

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Staff</h1>
        <p className="text-muted-foreground">
          Cashiers and managers who log into the till with a PIN. PINs are stored
          hashed and never shown again after they&apos;re set.
        </p>
      </div>
      <StaffManager staff={dto} />
    </div>
  );
}
