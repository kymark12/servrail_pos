"use server";

import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requirePosEntitlement } from "@/lib/entitlement";
import {
  getActiveStaff,
  setActiveStaff,
  clearActiveStaff,
  type ActiveStaff,
} from "@/lib/pos-session";

export type ClockInResult =
  | { ok: true; staff: ActiveStaff }
  | { ok: false; error: string };

// Verify a PIN against this business's active staff and clock that cashier in.
export async function clockIn(pin: string): Promise<ClockInResult> {
  const { business } = await requirePosEntitlement();

  if (!/^\d{4,6}$/.test(pin)) return { ok: false, error: "Enter a 4–6 digit PIN." };

  const staff = await prisma.staff.findMany({
    where: { businessId: business.id, isActive: true },
    select: { id: true, name: true, role: true, pinHash: true },
  });

  for (const s of staff) {
    if (await bcrypt.compare(pin, s.pinHash)) {
      await setActiveStaff(s.id);
      return { ok: true, staff: { id: s.id, name: s.name, role: s.role } };
    }
  }
  return { ok: false, error: "PIN not recognized." };
}

export async function clockOut(): Promise<void> {
  await clearActiveStaff();
}

const checkoutSchema = z.object({
  lines: z
    .array(z.object({ menuItemId: z.string().min(1), quantity: z.number().int().min(1).max(999) }))
    .min(1, "Cart is empty"),
});

export type ReceiptLine = { name: string; quantity: number; unitPrice: number; lineTotal: number };
export type CheckoutResult =
  | {
      ok: true;
      orderId: string;
      staffName: string;
      soldAt: string;
      total: number;
      lines: ReceiptLine[];
    }
  | { ok: false; error: string };

/**
 * Cash checkout. Snapshots item names/prices at sale time, creates the Order +
 * OrderItems, and — the POS↔DSS join — one SalesUpload(source=POS) + one
 * SalesRecord per line so the sale lands in the shared sales dataset. Online-first:
 * written straight through as SYNCED (the offline queue comes with the PWA pass).
 */
export async function checkout(input: unknown): Promise<CheckoutResult> {
  const { business } = await requirePosEntitlement();

  const staff = await getActiveStaff(business.id);
  if (!staff) return { ok: false, error: "No cashier is clocked in." };

  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid cart" };

  // Load the referenced items scoped to this business (active only), and snapshot.
  const ids = parsed.data.lines.map((l) => l.menuItemId);
  const items = await prisma.menuItem.findMany({
    where: { id: { in: ids }, businessId: business.id, isActive: true },
    select: { id: true, name: true, price: true },
  });
  const byId = new Map(items.map((i) => [i.id, i]));

  const receiptLines: ReceiptLine[] = [];
  for (const line of parsed.data.lines) {
    const item = byId.get(line.menuItemId);
    if (!item) return { ok: false, error: "An item is no longer available. Refresh the menu." };
    const unitPrice = Number(item.price);
    receiptLines.push({
      name: item.name,
      quantity: line.quantity,
      unitPrice,
      lineTotal: unitPrice * line.quantity,
    });
  }
  const total = receiptLines.reduce((sum, l) => sum + l.lineTotal, 0);
  const now = new Date();

  const orderId = await prisma.$transaction(async (tx) => {
    const order = await tx.order.create({
      data: {
        businessId: business.id,
        staffId: staff.id,
        localOrderId: randomUUID(),
        status: "SYNCED",
        syncedAt: now,
        items: {
          create: parsed.data.lines.map((line) => {
            const item = byId.get(line.menuItemId)!;
            return {
              menuItemId: item.id,
              itemName: item.name,
              quantity: line.quantity,
              unitPrice: item.price,
            };
          }),
        },
      },
    });

    // POS → DSS: one upload batch + one SalesRecord per line, tagged POS.
    const upload = await tx.salesUpload.create({
      data: {
        businessId: business.id,
        fileName: `POS order ${order.localOrderId}`,
        source: "POS",
        status: "COMMITTED",
        rowCount: receiptLines.length,
      },
    });
    await tx.salesRecord.createMany({
      data: receiptLines.map((l) => ({
        businessId: business.id,
        uploadId: upload.id,
        saleDate: now,
        itemName: l.name,
        quantity: l.quantity,
        unitPrice: new Prisma.Decimal(l.unitPrice),
        totalAmount: new Prisma.Decimal(l.lineTotal),
        paymentMethod: "CASH",
      })),
    });

    return order.id;
  });

  return {
    ok: true,
    orderId,
    staffName: staff.name,
    soldAt: now.toISOString(),
    total,
    lines: receiptLines,
  };
}
