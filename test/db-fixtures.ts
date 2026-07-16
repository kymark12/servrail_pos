import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

// Hard stop: these fixtures write data, so refuse to run against anything but the
// disposable local test DB. Guards against a stray env leaking the shared Neon URL.
function assertLocalDb() {
  const url = process.env.DATABASE_URL ?? "";
  if (!/@localhost[:/]|@127\.0\.0\.1[:/]/.test(url)) {
    throw new Error(
      `Refusing to run integration fixtures against a non-local DATABASE_URL (${url || "unset"}).`,
    );
  }
}

// Spins up an isolated tenant (its own Business, so everything cascades on delete)
// with an ACTIVE `pos` entitlement and one cashier — enough for the sync path.
export async function createTenant() {
  assertLocalDb();
  const business = await prisma.business.create({ data: { name: "Test Cafe" } });

  // The `pos` Product is a singleton (unique key) shared across tests — upsert it.
  const product = await prisma.product.upsert({
    where: { key: "pos" },
    create: { key: "pos", name: "POS" },
    update: {},
  });
  await prisma.entitlement.create({
    data: { businessId: business.id, productId: product.id, status: "ACTIVE" },
  });

  const staff = await prisma.staff.create({
    data: { businessId: business.id, name: "Cashier", pinHash: await bcrypt.hash("1234", 8) },
  });

  return { business, staff };
}

// Deleting the Business cascades to Staff / Orders / OrderItems / SalesUploads /
// SalesRecords / Entitlement. The shared `pos` Product is intentionally left.
export async function destroyTenant(businessId: string) {
  await prisma.business.delete({ where: { id: businessId } }).catch(() => {});
}
