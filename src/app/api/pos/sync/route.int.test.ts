import { afterAll, beforeAll, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { prisma } from "@/lib/db";
import { getActiveBusiness } from "@/lib/tenant";
import { hasPosEntitlement } from "@/lib/entitlement";
import { createTenant, destroyTenant } from "../../../../../test/db-fixtures";
import { POST } from "./route";

// Auth is exercised at its boundary — resolve the tenant/entitlement via mocks so
// the test doesn't need a NextAuth session, while the persistence path stays real.
vi.mock("@/lib/tenant", () => ({ getActiveBusiness: vi.fn() }));
vi.mock("@/lib/entitlement", () => ({ hasPosEntitlement: vi.fn() }));

let businessId: string;
let staffId: string;

function post(body: unknown) {
  return POST(
    new Request("http://localhost/api/pos/sync", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

function validOrder(over: Record<string, unknown> = {}) {
  return {
    localOrderId: crypto.randomUUID(),
    staffId,
    soldAt: new Date().toISOString(),
    lines: [{ menuItemId: "m1", itemName: "Latte", quantity: 2, unitPrice: 150 }],
    ...over,
  };
}

beforeAll(async () => {
  const t = await createTenant();
  businessId = t.business.id;
  staffId = t.staff.id;
});

afterAll(async () => {
  await destroyTenant(businessId);
  await prisma.$disconnect();
});

beforeEach(() => {
  // Default: signed-in owner of an entitled business.
  (getActiveBusiness as Mock).mockResolvedValue({
    userId: "user_1",
    role: "OWNER",
    business: { id: businessId },
  });
  (hasPosEntitlement as Mock).mockResolvedValue(true);
});

describe("POST /api/pos/sync", () => {
  it("persists a new order and returns its server id", async () => {
    const order = validOrder();
    const res = await post({ orders: [order] });
    expect(res.status).toBe(200);

    const { results } = await res.json();
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ localOrderId: order.localOrderId, status: "synced" });
    expect(results[0].serverOrderId).toBeTruthy();

    expect(
      await prisma.order.count({ where: { businessId, localOrderId: order.localOrderId } }),
    ).toBe(1);
  });

  it("replays idempotently — same id, no duplicate order", async () => {
    const order = validOrder();

    const first = await (await post({ orders: [order] })).json();
    const second = await (await post({ orders: [order] })).json();

    expect(second.results[0].status).toBe("synced");
    expect(second.results[0].serverOrderId).toBe(first.results[0].serverOrderId);
    expect(
      await prisma.order.count({ where: { businessId, localOrderId: order.localOrderId } }),
    ).toBe(1);
  });

  it("fails just the order whose cashier is unknown", async () => {
    const res = await post({ orders: [validOrder({ staffId: "ghost_staff" })] });
    const { results } = await res.json();
    expect(results[0]).toMatchObject({ status: "failed", error: "Unknown cashier" });
  });

  it("rejects a malformed body with 400", async () => {
    expect((await post({ orders: [] })).status).toBe(400); // min(1) violated
    expect((await post({ nope: true })).status).toBe(400);
  });

  it("returns 401 when there is no active tenant", async () => {
    (getActiveBusiness as Mock).mockResolvedValue(null);
    expect((await post({ orders: [validOrder()] })).status).toBe(401);
  });

  it("returns 401 when the business lacks the POS entitlement", async () => {
    (hasPosEntitlement as Mock).mockResolvedValue(false);
    expect((await post({ orders: [validOrder()] })).status).toBe(401);
  });
});
