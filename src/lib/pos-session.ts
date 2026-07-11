import { cookies } from "next/headers";
import { prisma } from "@/lib/db";

// Device-local "who's on shift" selection for the till, kept in an httpOnly cookie.
// This is distinct from the owner Auth.js session: the owner session establishes
// the business, this cookie tags orders with the active cashier.
const COOKIE = "pos_staff";

export type ActiveStaff = { id: string; name: string; role: "CASHIER" | "MANAGER" };

export async function setActiveStaff(staffId: string) {
  const store = await cookies();
  store.set(COOKIE, staffId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12, // a work shift
  });
}

export async function clearActiveStaff() {
  const store = await cookies();
  store.delete(COOKIE);
}

// Resolves the active cashier, verifying they still belong to this business and
// are active. Returns null if not clocked in (or the cookie is stale).
export async function getActiveStaff(businessId: string): Promise<ActiveStaff | null> {
  const store = await cookies();
  const staffId = store.get(COOKIE)?.value;
  if (!staffId) return null;

  const staff = await prisma.staff.findFirst({
    where: { id: staffId, businessId, isActive: true },
    select: { id: true, name: true, role: true },
  });
  return staff;
}
