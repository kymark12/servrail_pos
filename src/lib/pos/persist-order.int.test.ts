import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { persistPosOrder } from "./persist-order";
import { createTenant, destroyTenant } from "../../../test/db-fixtures";

let businessId: string;
let staffId: string;

beforeAll(async () => {
  const t = await createTenant();
  businessId = t.business.id;
  staffId = t.staff.id;
});

afterAll(async () => {
  await destroyTenant(businessId);
  await prisma.$disconnect();
});

const lines = [
  { menuItemId: "m1", itemName: "Latte", quantity: 2, unitPrice: 150 },
  { menuItemId: "m2", itemName: "Croissant", quantity: 1, unitPrice: 90 },
];

describe("persistPosOrder", () => {
  it("creates the Order, one POS SalesUpload, and one SalesRecord per line", async () => {
    const localOrderId = crypto.randomUUID();

    const res = await persistPosOrder(businessId, {
      localOrderId,
      staffId,
      soldAt: new Date("2026-07-16T02:00:00.000Z"),
      lines,
    });

    expect(res.created).toBe(true);

    const order = await prisma.order.findUniqueOrThrow({
      where: { businessId_localOrderId: { businessId, localOrderId } },
      include: { items: true },
    });
    expect(order.id).toBe(res.orderId);
    expect(order.status).toBe("SYNCED");
    expect(order.items).toHaveLength(2);

    const uploads = await prisma.salesUpload.findMany({ where: { businessId, source: "POS" } });
    expect(uploads).toHaveLength(1);
    expect(uploads[0].rowCount).toBe(2);

    const records = await prisma.salesRecord.findMany({ where: { uploadId: uploads[0].id } });
    expect(records).toHaveLength(2);
    const latte = records.find((r) => r.itemName === "Latte");
    expect(Number(latte?.totalAmount)).toBe(300); // 2 × 150, snapshot price
    expect(latte?.paymentMethod).toBe("CASH");
  });

  it("is idempotent: replaying the same localOrderId adds nothing", async () => {
    const localOrderId = crypto.randomUUID();
    const first = await persistPosOrder(businessId, {
      localOrderId,
      staffId,
      soldAt: new Date(),
      lines,
    });

    const replay = await persistPosOrder(businessId, {
      localOrderId,
      staffId,
      soldAt: new Date(),
      lines,
    });

    expect(replay.created).toBe(false);
    expect(replay.orderId).toBe(first.orderId);

    // Exactly one Order and one upload for this key — no duplicate sale recorded.
    expect(await prisma.order.count({ where: { businessId, localOrderId } })).toBe(1);
    const uploads = await prisma.salesUpload.findMany({
      where: { businessId, fileName: `POS order ${localOrderId}` },
    });
    expect(uploads).toHaveLength(1);
  });

  it("collapses a concurrent double-sync into a single Order", async () => {
    const localOrderId = crypto.randomUUID();
    const input = { localOrderId, staffId, soldAt: new Date(), lines };

    const [a, b] = await Promise.all([
      persistPosOrder(businessId, input),
      persistPosOrder(businessId, input),
    ]);

    expect(a.orderId).toBe(b.orderId); // same row regardless of who won the race
    expect(a.created !== b.created).toBe(true); // exactly one did the creating
    expect(await prisma.order.count({ where: { businessId, localOrderId } })).toBe(1);
    expect(
      await prisma.salesUpload.count({ where: { businessId, fileName: `POS order ${localOrderId}` } }),
    ).toBe(1);
  });
});
