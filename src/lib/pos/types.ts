// Shared types for the offline POS loop — used by the Dexie store, the sync
// engine, the /api/pos/sync route, and the till UI.

export type StaffRole = "CASHIER" | "MANAGER";

export type MenuItem = { id: string; name: string; price: number };
export type MenuCategory = { id: string; name: string; items: MenuItem[] };
export type MenuData = MenuCategory[];

// A sale line, snapshotted at checkout time (name + price frozen for the receipt
// and the server record, so an offline sale never depends on a live menu lookup).
export type OrderLine = {
  menuItemId: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
};

export type LocalOrderStatus = "queued" | "synced" | "failed";

// An order as held in IndexedDB.
export type LocalOrder = {
  localOrderId: string; // client-generated UUID (primary key + idempotency key)
  businessId: string;
  staffId: string;
  staffName: string;
  soldAt: string; // ISO timestamp (client clock at sale time)
  currency: string;
  total: number;
  lines: OrderLine[];
  status: LocalOrderStatus;
  error?: string;
  serverOrderId?: string;
  syncedAt?: string;
};

// Cached staff record for offline PIN clock-in.
export type StaffCredential = {
  id: string;
  businessId: string;
  name: string;
  role: StaffRole;
  pinHash: string;
};

// The device-local "who's on shift" selection (replaces the server cookie offline).
export type PosSession = {
  staffId: string;
  staffName: string;
  role: StaffRole;
  businessId: string;
};

// ── /api/pos/sync wire types ──
export type SyncOrderInput = {
  localOrderId: string;
  staffId: string;
  soldAt: string;
  lines: OrderLine[];
};
export type SyncOrderResult = {
  localOrderId: string;
  status: "synced" | "failed";
  serverOrderId?: string;
  error?: string;
};
export type SyncResponse = { results: SyncOrderResult[] };
