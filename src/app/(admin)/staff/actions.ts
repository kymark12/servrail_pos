"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { StaffRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requirePosEntitlement } from "@/lib/entitlement";

export type ActionResult = { ok: true } | { ok: false; error: string };

const pin = z
  .string()
  .regex(/^\d{4,6}$/, "PIN must be 4–6 digits");

const baseSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  role: z.nativeEnum(StaffRole),
});

// PINs are bcrypt-hashed, so they can't be looked up by value. To keep a PIN
// unique within a business (the till maps an entered PIN to exactly one cashier),
// compare the candidate against existing active hashes. Fine at prototype scale.
async function pinCollides(businessId: string, candidatePin: string, excludeStaffId?: string) {
  const staff = await prisma.staff.findMany({
    where: { businessId, isActive: true, ...(excludeStaffId ? { id: { not: excludeStaffId } } : {}) },
    select: { pinHash: true },
  });
  for (const s of staff) {
    if (await bcrypt.compare(candidatePin, s.pinHash)) return true;
  }
  return false;
}

export async function createStaff(input: unknown): Promise<ActionResult> {
  const { business } = await requirePosEntitlement();
  const schema = baseSchema.extend({ pin });
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  if (await pinCollides(business.id, parsed.data.pin)) {
    return { ok: false, error: "That PIN is already in use. Pick a different one." };
  }

  await prisma.staff.create({
    data: {
      businessId: business.id,
      name: parsed.data.name,
      role: parsed.data.role,
      pinHash: await bcrypt.hash(parsed.data.pin, 10),
    },
  });
  revalidatePath("/staff");
  return { ok: true };
}

export async function updateStaff(input: unknown): Promise<ActionResult> {
  const { business } = await requirePosEntitlement();
  // PIN optional on update — only re-hash when a new one is supplied.
  const schema = baseSchema.extend({
    id: z.string().min(1),
    pin: z.union([pin, z.literal("")]).optional(),
  });
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const owned = await prisma.staff.findFirst({
    where: { id: parsed.data.id, businessId: business.id },
    select: { id: true },
  });
  if (!owned) return { ok: false, error: "Staff not found" };

  const newPin = parsed.data.pin;
  if (newPin) {
    if (await pinCollides(business.id, newPin, parsed.data.id)) {
      return { ok: false, error: "That PIN is already in use. Pick a different one." };
    }
  }

  await prisma.staff.update({
    where: { id: parsed.data.id },
    data: {
      name: parsed.data.name,
      role: parsed.data.role,
      ...(newPin ? { pinHash: await bcrypt.hash(newPin, 10) } : {}),
    },
  });
  revalidatePath("/staff");
  return { ok: true };
}

export async function setStaffActive(id: string, isActive: boolean): Promise<ActionResult> {
  const { business } = await requirePosEntitlement();
  const result = await prisma.staff.updateMany({
    where: { id, businessId: business.id },
    data: { isActive },
  });
  if (result.count === 0) return { ok: false, error: "Staff not found" };
  revalidatePath("/staff");
  return { ok: true };
}

export async function deleteStaff(id: string): Promise<ActionResult> {
  const { business } = await requirePosEntitlement();
  // Staff with orders can't be hard-deleted (Order.staffId is RESTRICT). Fall back
  // to deactivating so order history stays intact.
  const orderCount = await prisma.order.count({ where: { staffId: id, businessId: business.id } });
  if (orderCount > 0) {
    const result = await prisma.staff.updateMany({
      where: { id, businessId: business.id },
      data: { isActive: false },
    });
    if (result.count === 0) return { ok: false, error: "Staff not found" };
    revalidatePath("/staff");
    return { ok: false, error: "This staff member has orders, so they were deactivated instead of deleted." };
  }

  const result = await prisma.staff.deleteMany({ where: { id, businessId: business.id } });
  if (result.count === 0) return { ok: false, error: "Staff not found" };
  revalidatePath("/staff");
  return { ok: true };
}
