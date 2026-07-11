import { requirePosEntitlement } from "@/lib/entitlement";
import { prisma } from "@/lib/db";
import { MenuManager, type CategoryDTO } from "@/components/admin/menu-manager";

export default async function MenuPage() {
  const { business } = await requirePosEntitlement();

  const categories = await prisma.menuCategory.findMany({
    where: { businessId: business.id },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { items: { orderBy: { name: "asc" } } },
  });

  // Serialize Decimals to strings before handing to the client component.
  const dto: CategoryDTO[] = categories.map((c) => ({
    id: c.id,
    name: c.name,
    sortOrder: c.sortOrder,
    items: c.items.map((i) => ({
      id: i.id,
      categoryId: i.categoryId,
      name: i.name,
      price: i.price.toFixed(2),
      isActive: i.isActive,
    })),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Menu</h1>
        <p className="text-muted-foreground">
          Categories and items the till will show. Prices are in {business.currency}.
        </p>
      </div>
      <MenuManager categories={dto} currency={business.currency} />
    </div>
  );
}
