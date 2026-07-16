import { requirePosEntitlement } from "@/lib/entitlement";
import { prisma } from "@/lib/db";
import { Till, type MenuData } from "@/components/pos/till";
import type { StaffCredential } from "@/lib/pos/types";

// Cashier till. Owner session + POS entitlement establish the business; the menu
// and staff (incl. PIN hashes) are handed to the client so the till can clock in
// and sell fully offline once it has loaded online at least once.
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

  // Only reachable by an authenticated owner with POS entitlement; the PIN hashes
  // are cached client-side (IndexedDB) so clock-in works with no connectivity.
  const staff = await prisma.staff.findMany({
    where: { businessId: business.id, isActive: true },
    select: { id: true, name: true, role: true, pinHash: true },
  });
  const staffCredentials: StaffCredential[] = staff.map((s) => ({
    id: s.id,
    businessId: business.id,
    name: s.name,
    role: s.role,
    pinHash: s.pinHash,
  }));

  return (
    <Till
      businessId={business.id}
      businessName={business.name}
      currency={business.currency}
      menu={menu}
      staffCredentials={staffCredentials}
    />
  );
}
