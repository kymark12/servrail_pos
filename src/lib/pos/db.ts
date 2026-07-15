import Dexie, { type Table } from "dexie";
import type {
  LocalOrder,
  MenuData,
  PosSession,
  StaffCredential,
} from "./types";

// The catalog snapshot, kept as a single row so a cold offline boot still has a
// menu to sell from even if the server-rendered page came from stale cache.
export type MenuSnapshot = {
  id: string; // always "current"
  businessId: string;
  currency: string;
  categories: MenuData;
  updatedAt: string;
};

type SessionRow = PosSession & { id: string }; // id always "active"

class PosDatabase extends Dexie {
  orders!: Table<LocalOrder, string>;
  menu!: Table<MenuSnapshot, string>;
  staff!: Table<StaffCredential, string>;
  session!: Table<SessionRow, string>;

  constructor() {
    super("servrail-pos");
    this.version(1).stores({
      orders: "localOrderId, status, businessId",
      menu: "id",
      staff: "id, businessId",
      session: "id",
    });
  }
}

// Lazily constructed so importing this module on the server (RSC/route) never
// touches IndexedDB. All callers here run in the browser (client components).
let _db: PosDatabase | null = null;
export function db(): PosDatabase {
  if (typeof window === "undefined") {
    throw new Error("The offline POS store is browser-only.");
  }
  return (_db ??= new PosDatabase());
}

// ── Orders ──────────────────────────────────────────────────────────────────
export async function queueOrder(order: LocalOrder): Promise<void> {
  await db().orders.put(order);
}
export async function syncableOrders(): Promise<LocalOrder[]> {
  return db().orders.where("status").anyOf("queued", "failed").toArray();
}
export async function queuedCount(): Promise<number> {
  return db().orders.where("status").anyOf("queued", "failed").count();
}

// ── Menu snapshot ─────────────────────────────────────────────────────────────
export async function cacheMenu(
  snap: Omit<MenuSnapshot, "id" | "updatedAt">,
): Promise<void> {
  await db().menu.put({ ...snap, id: "current", updatedAt: new Date().toISOString() });
}
export async function cachedMenu(): Promise<MenuSnapshot | undefined> {
  return db().menu.get("current");
}

// ── Staff credentials (for offline PIN) ───────────────────────────────────────
// Replace the whole cached set for this business so deactivated staff drop out.
export async function cacheStaff(
  businessId: string,
  staff: StaffCredential[],
): Promise<void> {
  await db().transaction("rw", db().staff, async () => {
    await db().staff.where("businessId").equals(businessId).delete();
    if (staff.length) await db().staff.bulkPut(staff);
  });
}

// ── Session (who's clocked in) ────────────────────────────────────────────────
export async function getSession(): Promise<PosSession | null> {
  const row = await db().session.get("active");
  if (!row) return null;
  const { id: _id, ...session } = row;
  return session;
}
export async function setSession(session: PosSession): Promise<void> {
  await db().session.put({ ...session, id: "active" });
}
export async function clearSession(): Promise<void> {
  await db().session.delete("active");
}
