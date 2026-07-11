import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { Business, Role } from "@prisma/client";

export type TenantContext = {
  userId: string;
  business: Business;
  role: Role;
};

// Resolves the caller's active business from the session and verifies membership.
// Every tenant-scoped query should derive its businessId from here — never trust a
// businessId passed in from the client. (Same gate DSS uses.)
export async function getActiveBusiness(): Promise<TenantContext | null> {
  const session = await auth();
  const userId = session?.user?.id;
  const businessId = session?.user?.activeBusinessId;
  if (!userId || !businessId) return null;

  const membership = await prisma.membership.findUnique({
    where: { userId_businessId: { userId, businessId } },
    include: { business: true },
  });
  if (!membership) return null;

  return { userId, business: membership.business, role: membership.role };
}
