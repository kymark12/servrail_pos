import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getActiveBusiness, type TenantContext } from "@/lib/tenant";

// The stable product-catalog slug the back-office grants against (src/lib/products.ts).
export const POS_PRODUCT_KEY = "pos";

/**
 * Returns true if the business has an ACTIVE entitlement for the POS product.
 * Read-only: entitlements are granted/suspended in the back-office, never here.
 */
export async function hasPosEntitlement(businessId: string): Promise<boolean> {
  const entitlement = await prisma.entitlement.findFirst({
    where: {
      businessId,
      status: "ACTIVE",
      product: { key: POS_PRODUCT_KEY },
    },
    select: { id: true },
  });
  return entitlement !== null;
}

/**
 * Server-side guard for POS tenant-admin pages and actions. Resolves the active
 * business, then requires an ACTIVE POS entitlement — redirecting to /sign-in if
 * not signed in, or /not-enabled if the business lacks the POS product.
 */
export async function requirePosEntitlement(): Promise<TenantContext> {
  const tenant = await getActiveBusiness();
  if (!tenant) redirect("/sign-in");

  if (!(await hasPosEntitlement(tenant.business.id))) {
    redirect("/not-enabled");
  }
  return tenant;
}
