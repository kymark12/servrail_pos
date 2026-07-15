import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getActiveBusiness } from "@/lib/tenant";
import { hasPosEntitlement } from "@/lib/entitlement";
import { persistPosOrder } from "@/lib/pos/persist-order";
import type { SyncOrderResult } from "@/lib/pos/types";

// Idempotent sync endpoint for queued offline orders. Auth is the owner session
// (resolved without redirecting, so a stale session returns a clean 401 the sync
// loop can retry against). Each order is upserted on (businessId, localOrderId).
const bodySchema = z.object({
  orders: z
    .array(
      z.object({
        localOrderId: z.string().uuid(),
        staffId: z.string().min(1),
        soldAt: z.string().datetime(),
        lines: z
          .array(
            z.object({
              menuItemId: z.string().min(1),
              itemName: z.string().min(1).max(120),
              quantity: z.number().int().min(1).max(999),
              unitPrice: z.number().nonnegative().max(1_000_000),
            }),
          )
          .min(1),
      }),
    )
    .min(1)
    .max(200),
});

export async function POST(req: Request) {
  const tenant = await getActiveBusiness();
  if (!tenant || !(await hasPosEntitlement(tenant.business.id))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const businessId = tenant.business.id;

  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  // Orders carry a client-provided staffId; only accept staff of this business.
  const staffRows = await prisma.staff.findMany({
    where: { businessId },
    select: { id: true },
  });
  const staffIds = new Set(staffRows.map((s) => s.id));

  const results: SyncOrderResult[] = [];
  for (const order of parsed.data.orders) {
    if (!staffIds.has(order.staffId)) {
      results.push({ localOrderId: order.localOrderId, status: "failed", error: "Unknown cashier" });
      continue;
    }
    try {
      const { orderId } = await persistPosOrder(businessId, {
        localOrderId: order.localOrderId,
        staffId: order.staffId,
        soldAt: new Date(order.soldAt),
        lines: order.lines,
      });
      results.push({ localOrderId: order.localOrderId, status: "synced", serverOrderId: orderId });
    } catch (e) {
      results.push({
        localOrderId: order.localOrderId,
        status: "failed",
        error: e instanceof Error ? e.message : "Sync failed",
      });
    }
  }

  return NextResponse.json({ results });
}
