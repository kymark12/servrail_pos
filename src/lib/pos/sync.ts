import { db, syncableOrders } from "./db";
import type { SyncResponse } from "./types";

let inFlight = false;

/**
 * Push all queued/failed orders to the server and reconcile local status.
 * Single-flight and network-guarded, so it's safe to call on a timer, on
 * reconnect, and right after a checkout. Returns null when it skipped without a
 * server round-trip (offline, already running, or a non-OK response) — pending
 * orders are left in place for the next attempt.
 */
export async function syncQueue(): Promise<{ synced: number; failed: number } | null> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return null;
  if (inFlight) return null;
  inFlight = true;
  try {
    const pending = await syncableOrders();
    if (pending.length === 0) return { synced: 0, failed: 0 };

    const res = await fetch("/api/pos/sync", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        orders: pending.map((o) => ({
          localOrderId: o.localOrderId,
          staffId: o.staffId,
          soldAt: o.soldAt,
          lines: o.lines,
        })),
      }),
    });
    if (!res.ok) return null; // auth/network — leave everything queued to retry

    const data = (await res.json()) as SyncResponse;
    let synced = 0;
    let failed = 0;
    for (const r of data.results) {
      if (r.status === "synced") {
        await db().orders.update(r.localOrderId, {
          status: "synced",
          serverOrderId: r.serverOrderId,
          syncedAt: new Date().toISOString(),
          error: undefined,
        });
        synced++;
      } else {
        await db().orders.update(r.localOrderId, { status: "failed", error: r.error });
        failed++;
      }
    }
    return { synced, failed };
  } catch {
    return null;
  } finally {
    inFlight = false;
  }
}
