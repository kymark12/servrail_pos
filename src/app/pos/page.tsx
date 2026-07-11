import { requirePosEntitlement } from "@/lib/entitlement";
import { prisma } from "@/lib/db";
import { getActiveStaff } from "@/lib/pos-session";
import { Till, type MenuData } from "@/components/pos/till";

// Cashier till. Owner session + POS entitlement establish the business; a
// device-local PIN then selects the active cashier.
export default async function PosPage() {
  const { business } = await requirePosEntitlement();

  const categories = await prisma.menuCategory.findMany({
    where: { businessId: business.id },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      items: {
        where: { isActive: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true, price: true },
      },
    },
  });

  const menu: MenuData = categories
    .filter((c) => c.items.length > 0)
    .map((c) => ({
      id: c.id,
      name: c.name,
      items: c.items.map((i) => ({ id: i.id, name: i.name, price: Number(i.price) })),
    }));

  const activeStaff = await getActiveStaff(business.id);

  return (
    <Till
      businessName={business.name}
      currency={business.currency}
      menu={menu}
      initialStaff={activeStaff}
    />
  );
}
