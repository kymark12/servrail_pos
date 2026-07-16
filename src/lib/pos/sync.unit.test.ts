// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db, queueOrder } from "./db";
import { syncQueue } from "./sync";
import type { LocalOrder, SyncResponse } from "./types";

function order(over: Partial<LocalOrder> = {}): LocalOrder {
  return {
    localOrderId: "o1",
    businessId: "biz_1",
    staffId: "staff_1",
    staffName: "Alice",
    soldAt: "2026-07-16T02:00:00.000Z",
    currency: "PHP",
    total: 300,
    lines: [{ menuItemId: "m1", itemName: "Latte", quantity: 2, unitPrice: 150 }],
    status: "queued",
    ...over,
  };
}

function mockFetch(body: SyncResponse, ok = true) {
  const fn = vi.fn().mockResolvedValue({
    ok,
    json: async () => body,
  } as Response);
  vi.stubGlobal("fetch", fn);
  return fn;
}

function setOnline(online: boolean) {
  Object.defineProperty(navigator, "onLine", { value: online, configurable: true });
}

beforeEach(async () => {
  await db().orders.clear();
  setOnline(true);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("syncQueue", () => {
  it("marks each order per the server result and reports the tally", async () => {
    await queueOrder(order({ localOrderId: "ok" }));
    await queueOrder(order({ localOrderId: "bad" }));
    mockFetch({
      results: [
        { localOrderId: "ok", status: "synced", serverOrderId: "srv_1" },
        { localOrderId: "bad", status: "failed", error: "Unknown cashier" },
      ],
    });

    const summary = await syncQueue();
    expect(summary).toEqual({ synced: 1, failed: 1 });

    const ok = await db().orders.get("ok");
    expect(ok?.status).toBe("synced");
    expect(ok?.serverOrderId).toBe("srv_1");
    expect(ok?.syncedAt).toBeTruthy();
    expect(ok?.error).toBeUndefined();

    const bad = await db().orders.get("bad");
    expect(bad?.status).toBe("failed");
    expect(bad?.error).toBe("Unknown cashier");
  });

  it("no-ops with a zero tally when the queue is empty", async () => {
    const fetchFn = mockFetch({ results: [] });
    expect(await syncQueue()).toEqual({ synced: 0, failed: 0 });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("skips the round-trip and leaves orders queued while offline", async () => {
    await queueOrder(order({ localOrderId: "o1" }));
    setOnline(false);
    const fetchFn = mockFetch({ results: [] });

    expect(await syncQueue()).toBeNull();
    expect(fetchFn).not.toHaveBeenCalled();
    expect((await db().orders.get("o1"))?.status).toBe("queued");
  });

  it("leaves orders queued when the server responds non-OK (e.g. 401)", async () => {
    await queueOrder(order({ localOrderId: "o1" }));
    mockFetch({ results: [] }, false);

    expect(await syncQueue()).toBeNull();
    expect((await db().orders.get("o1"))?.status).toBe("queued");
  });

  it("single-flights concurrent calls", async () => {
    await queueOrder(order({ localOrderId: "o1" }));
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const fetchFn = vi.fn().mockImplementation(async () => {
      await gate;
      return { ok: true, json: async () => ({ results: [] }) } as Response;
    });
    vi.stubGlobal("fetch", fetchFn);

    const first = syncQueue();
    const second = await syncQueue(); // second call bails out immediately
    expect(second).toBeNull();

    release();
    await first;
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });
});
