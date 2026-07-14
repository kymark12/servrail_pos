# ServRail POS — Prototype Roadmap

**Product:** ServRail Custom Build — Touch-first PWA POS (flagship tier)
**Format:** Multi-tenant back-office + offline-first PWA client + printer plugin
**Target build tool:** Claude Code
**Author:** Marky | **Date:** 2026-07-09

---

## 1. Positioning Note

This is a Custom Build product, not a Core Platform à la carte item (see `ServRail_Core_vs_Custom_Positioning.docx`) — it's bespoke architecture, not the templated Sheets+AppSheet stack. Once live, POS transactions become the primary source of truth for a client's sales data, which reframes several Core Platform products (Inventory Tracker, Menu Cost Calculator, Loyalty Points, Daily Sales Summary) from standalone manual-entry tools into modules that read off the POS transaction stream.

This build shares its tenant model and `SalesRecord` schema with the Daily Sales Summary app (`Core Products/daily-sales-summary-app`) rather than duplicating it — see Section 4.

Prototype philosophy: guerilla-style validation before hardware or scope commitment. Prove the architecture on owned/cheap hardware first (Section 8), then harden for pilot.

---

## 2. Scope Note — What's In vs Out for the Prototype

Keeping this explicit so the prototype stays a prototype and doesn't quietly become the full pilot build.

**In scope (v1 prototype):**
- Single business, single till, cash-only checkout
- Menu/catalog management (basic — name, price, category)
- Staff PIN login on the POS client
- Offline order capture + background sync
- Thermal receipt printing via the plugin (Section 6.3)
- Back-office: client + staff management, per-client product/service enablement

**Explicitly out of scope for v1 (flagged for pilot phase, not forgotten):**
- Digital payment methods (GCash/Maya/card) — cash-only until the core loop is proven
- Kitchen display / order routing / multi-station tickets — single-till counter service only
- Multi-till conflict resolution (two devices selling the last unit of the same item while both offline) — real risk, deferred until multi-device is actually needed
- BIR EIS structured e-invoice transmission — not required yet for small POS users (see Section 9), but the receipt format is being designed to not paint us into a corner later
- Digital-receipt delivery (SMS/email/QR) — printer-first for v1, digital as a later add-on

---

## 3. Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Back-office | Next.js 15 (App Router, TS) — extends the existing `daily-sales-summary-app` repo/schema rather than a new one | Reuses the `Business`/`Membership`/`SalesRecord` model already built; avoids maintaining two tenant systems |
| POS client (PWA) | Next.js 15, same monorepo, separate route group (`/pos`) with its own service worker | Shared codebase and auth, but built and cached independently so it works fully offline on the tablet |
| Offline storage/queue | Dexie.js (IndexedDB wrapper) | Local order queue while offline; simpler API than raw IndexedDB for queue + retry logic |
| Service worker / offline shell | Serwist (`next-pwa` successor) | Precaches the POS shell so it loads with zero network, not just cached-after-first-visit |
| ORM / DB | Prisma 6 + PostgreSQL (Neon/Supabase) — same instance as DSS | One source of truth for `SalesRecord`; POS and DSS both write into it |
| Printer integration | WebUSB API (primary), Web Bluetooth API (fallback, BLE only) | See Section 6.3 for the printer-specific reasoning |
| Auth | Auth.js (back-office, full accounts) + custom PIN-based session for POS staff logins (lightweight, device-local) | Back-office needs real accounts; a POS till needs a 5-second staff switch, not email/password |
| Hosting | Vercel (app) + Neon/Supabase (DB) | Consistent with DSS deployment |

---

## 4. Multi-Tenancy & Product Model

Extends the existing `Business` → `Membership` model from the DSS app with a **Product catalog** and **enablement layer** — this is what answers your "connect other products, ala carte or bundled" requirement.

```
Business (tenant)
 ├── Membership (back-office user ↔ business, role: OWNER/STAFF)
 ├── Staff (POS-specific, PIN login, distinct from back-office User)
 ├── BusinessProduct (which ServRail products are enabled for this business, and how)
 ├── MenuCategory → MenuItem (this business's sellable catalog)
 ├── Order → OrderItem (POS transactions, captured offline-first)
 ├── PrinterConfig (which printer this business's till is paired with)
 └── SalesRecord (shared with DSS — POS orders sync into this, tagged by source)

Product (catalog, not tenant-scoped)
 └── BusinessProduct (join: Business ↔ Product, status: ACTIVE/TRIAL/INACTIVE, enabledAt)
```

`Product` is a static catalog row per ServRail offering (Daily Sales Summary, Inventory Tracker, POS, Menu Cost Calculator, Loyalty Points, etc. — the 10-item menu plus POS as an 11th, Custom-tier entry). `BusinessProduct` is what makes a client's stack either à la carte (enable just POS) or bundled (enable POS + DSS + Loyalty together) without any code branching — the back-office just toggles rows.

---

## 5. Data Model Sketch (Prisma, additive to the existing DSS schema)

```prisma
model Product {
  id          String   @id @default(cuid())
  key         String   @unique   // "pos", "daily-sales-summary", "inventory-tracker", etc.
  name        String
  tier        Tier     @default(CORE)
  businesses  BusinessProduct[]
}

enum Tier {
  CORE
  CUSTOM
}

model BusinessProduct {
  id          String   @id @default(cuid())
  businessId  String
  productId   String
  status      ProductStatus @default(TRIAL)
  enabledAt   DateTime @default(now())
  business    Business @relation(fields: [businessId], references: [id])
  product     Product  @relation(fields: [productId], references: [id])
  @@unique([businessId, productId])
}

enum ProductStatus {
  TRIAL
  ACTIVE
  INACTIVE
}

model Staff {
  id          String   @id @default(cuid())
  businessId  String
  name        String
  pinHash     String            // hashed PIN, device-local quick login
  role        StaffRole @default(CASHIER)
  business    Business @relation(fields: [businessId], references: [id])
  orders      Order[]
}

enum StaffRole {
  CASHIER
  MANAGER
}

model MenuCategory {
  id          String   @id @default(cuid())
  businessId  String
  name        String
  sortOrder   Int      @default(0)
  items       MenuItem[]
}

model MenuItem {
  id          String   @id @default(cuid())
  businessId  String
  categoryId  String
  name        String
  price       Decimal
  isActive    Boolean  @default(true)
  category    MenuCategory @relation(fields: [categoryId], references: [id])
}

model Order {
  id            String   @id @default(cuid())
  businessId    String
  staffId       String
  localOrderId  String   // client-generated UUID, set while offline, for idempotent sync
  status        OrderStatus @default(QUEUED)
  createdAt     DateTime @default(now())
  syncedAt      DateTime?
  items         OrderItem[]
  staff         Staff    @relation(fields: [staffId], references: [id])
  @@unique([businessId, localOrderId])   // prevents double-sync on retry
}

enum OrderStatus {
  QUEUED     // captured locally, not yet synced
  SYNCED     // synced to server, SalesRecord created
  FAILED     // sync attempted, rejected (needs manual review)
}

model OrderItem {
  id          String   @id @default(cuid())
  orderId     String
  menuItemId  String
  quantity    Int
  unitPrice   Decimal   // snapshot at time of sale, not a live join to MenuItem
  order       Order    @relation(fields: [orderId], references: [id])
}

model PrinterConfig {
  id              String   @id @default(cuid())
  businessId      String
  connectionType  PrinterConnection
  vendorProductId String?  // USB vendor/product ID for reconnect matching
  paperWidthMm    Int      @default(58)
  lastPairedAt    DateTime?
}

enum PrinterConnection {
  USB
  BLUETOOTH
}
```

`SalesRecord` (already defined in the DSS schema) gains one field for this integration:

```prisma
// addition to existing SalesRecord model
source    SalesSource @default(MANUAL_UPLOAD)

enum SalesSource {
  MANUAL_UPLOAD   // existing DSS spreadsheet upload path
  POS_SYNC        // new — synced from an Order
}
```

An `Order` becomes a `SalesRecord` (one row per `OrderItem`) the moment it syncs — this is the join between the two products.

---

## 6. Component Breakdown

### 6.1 Client-Facing PWA (tablet-first, mobile-capable)

- Responsive layout: designed for tablet (10–12.4") first, degrades gracefully to phone width — larger tap targets, no hover-dependent UI, since this is the touch-first requirement from day one.
- Screens: staff PIN login → menu grid (category tabs, item cards) → cart/order summary → checkout (cash only, v1) → receipt print → confirmation/next order.
- Offline-first by construction, not as an afterthought: every action writes to the local Dexie queue immediately; a background sync process pushes `QUEUED` orders to the server whenever connectivity is available, using `localOrderId` for idempotent retries so a flaky connection never double-charges a sale.
- Installable (PWA manifest + service worker) so it behaves like a native app icon on the tablet home screen, no browser chrome.

### 6.2 Back-Office Admin

- **Client management:** create/edit Business records, view enabled products per client.
- **Staff/employee management:** add Staff (POS PIN logins) and Membership (back-office User accounts) — these are intentionally separate, since a till cashier needs a fast PIN switch, not a dashboard login.
- **Product/service enablement:** toggle `BusinessProduct` rows per client — this is the ala-carte/bundle system. A client can run POS alone, POS + DSS, or the full stack, and it's a data toggle, not a deployment decision.
- **Menu management:** owns `MenuCategory`/`MenuItem` — what the POS client renders. (Longer-term this is where Menu Cost Calculator would plug in, reading the same `MenuItem` catalog.)
- Later, not v1: cross-product reporting surface that reads `SalesRecord` regardless of `source`, so an owner sees one number whether it came from POS sync or a manual DSS upload.

### 6.3 Thermal Printer Plugin

- Targets **one printer model** for v1 (the Shopee USB+Bluetooth 58mm unit confirmed ESC/POS-compatible — see Section 8), not a printer catalog. Broader hardware support is a post-prototype decision.
- **Connection priority: USB first, Bluetooth fallback.** WebUSB is used because it's unambiguous and well-documented; Web Bluetooth is kept as a fallback path but only works if the printer's Bluetooth radio is BLE, not Classic SPP — this needs to be confirmed against the actual unit once it arrives (Section 8 flags this as unresolved).
- Encodes receipts using ESC/POS commands (via a JS ESC/POS encoder library) — business name/address, itemized order, total, payment method, timestamp, and a placeholder line for the BIR PTU/invoice number once that's finalized (Section 9).
- Print queue with retry: if the printer is offline, out of paper, or the connection drops mid-print, the order still exists in `SYNCED` state — printing is decoupled from the sale itself, so a printer fault never blocks checkout.

---

## 7. Sync & Fallback Architecture (recap)

Two ingestion paths write into the same `SalesRecord` table, distinguished by `source`:

1. **Primary — POS live sync:** `Order` captured offline in Dexie → background sync pushes to server when online → server creates `SalesRecord` rows tagged `POS_SYNC`.
2. **Fallback — manual export/upload:** if a till stays offline long enough that background sync isn't realistic (extended outage, device swap), staff export the queued orders to a file matching the DSS upload format, and it goes through the existing DSS upload flow, tagged `MANUAL_UPLOAD`.

This means the DSS build already in progress isn't parallel work — it's the resilience layer under the POS.

---

## 8. Hardware / Test Environment

**Prototype (now):**
- Device: Marky's Samsung Galaxy Z Fold 4 — confirmed native USB-OTG, test in Chrome (not Samsung Internet).
- Printer: generic USB+Bluetooth 58mm thermal printer, ₱861, Shopee "Preferred" seller, confirmed ESC/POS + Star mode compatible, bundled with 10 paper rolls. **Open item:** confirm on arrival whether its Bluetooth radio is BLE or Classic SPP (the fixed "0000" pairing password suggests Classic, which Web Bluetooth cannot use) — doesn't block the prototype since USB is the primary path regardless.
- Optional stretch test: Fold 4 Flex Mode for a dual-screen checkout mockup (staff inner screen, customer-facing total on cover screen) — validated as a real market pattern (StoreHub sells this on Sunmi hardware), cost is zero since it's the same device.

**Pilot reference (post-prototype):**
- Lenovo Tab M10 (3rd Gen), 4GB/64GB, ~₱12,995 via official Lenovo channel, confirmed USB-OTG, Android 11 w/ 3 years security updates.
- Same printer, bundle ≈ ₱13,850/station.
- Ruled out: Sunmi D3 Pro + StoreHub customer-facing display — commercial POS terminal pricing is beyond target client budget, and it's sold through a direct competitor's own hardware channel (lock-in risk).

---

## 9. BIR / Compliance Notes

- Printer output is required by default, not optional — BIR's e-invoicing mandate (RR 11-2025) doesn't cover small POS users yet (compliance deadline Dec 31, 2026 applies to large taxpayers, e-commerce, LTS, and CAS/invoicing-software users only), but record-retention rules still require printed backups for the first 5 years even for businesses that do e-invoice. Digital-only receipts aren't safe ground yet for a small client.
- Receipt template should reserve a line for a Permit to Use (PTU) reference / invoice sequence number even though accreditation isn't in scope for the prototype — cheaper to design the field in now than retrofit the receipt format later.
- This is a factual summary, not tax advice. Any client-facing default (e.g., ever going receipt-optional) should be confirmed with that client's own accountant before it ships.

**Scope reminder — accreditation applies to POS only, not the other 9 products:** BIR's CRM/POS accreditation (RR 11-2004: PTU, decals, per-device fees) and CAS/CBA registration are triggered specifically by (a) generating official receipts/invoices, or (b) serving as a business's official books of accounts. Daily Sales Summary, Inventory Tracker, Expense Tracker, Menu Cost Calculator, Supplier Order Generator, Reservation Bot, Feedback Collector, Loyalty Points, and Social Media Auto-Scheduler don't issue receipts and aren't a client's system of record — none of them need BIR accreditation on their own. The only exception to watch: if a client starts treating Daily Sales Summary or Expense Tracker as their *actual* bookkeeping system rather than a reporting layer fed by data booked elsewhere, that specific product could tip into CAS registration territory. As long as those stay downstream/reporting views, they're clear. POS is the one product in the lineup where accreditation is a hard gate before real transactions.

---

## 10. Build Phases

| Phase | Scope | Outcome |
|---|---|---|
| 0 | Extend DSS repo: `Product`, `BusinessProduct`, `Staff`, `MenuCategory`, `MenuItem`, `Order`, `OrderItem`, `PrinterConfig` models + migration; add `source` to `SalesRecord` | Schema supports POS without breaking DSS |
| 1 | Back-office: client management (already partially exists via DSS) + Staff CRUD + `BusinessProduct` toggle UI | Owner can enable POS for a business and add staff |
| 2 | POS client shell: PWA manifest, service worker (Serwist), staff PIN login, route group `/pos` | Installable, offline-loadable app skeleton on the Fold 4 |
| 3 | Menu management (back-office) + menu rendering (POS client) | Staff can browse a real catalog on the tablet |
| 4 | Cart + checkout (cash-only) + Dexie offline queue + background sync to `Order`/`SalesRecord` | Full offline order loop working end-to-end |
| 5 | Printer plugin: WebUSB connection, ESC/POS receipt encoding, print queue/retry against the confirmed prototype printer | Physical receipt prints from a real order |
| 6 | Hardware validation pass on Fold 4 + printer; fix any WebUSB/Bluetooth surprises found | Prototype proven on guerilla hardware |
| 7 | Pilot-readiness pass: swap to Lenovo Tab M10 reference hardware, load-test offline queue with a simulated multi-hour outage | Ready to quote a real pilot client |

---

## 11. Open Decisions to Confirm

- **Payment methods for pilot (post-prototype):** cash-only proves the loop, but most clients will want GCash/Maya QR at minimum before this is sellable — worth scoping early even if not built yet.
- **Kitchen/order routing:** confirmed out of scope for v1 (Section 2) — revisit once a client with a kitchen (vs. counter-only café) is in the pipeline.
- **Multi-till conflict handling:** deferred, but worth flagging now — the day a client wants two tills, the "two devices sell the last unit while both offline" problem becomes real and needs design work before that client goes live.
- **Invoice numbering scheme:** needs a defined sequence (per-business, per-till, or global) before the receipt template's PTU/invoice line can be finalized.
- **Staff PIN security model:** PIN hash stored locally vs. synced from back-office — affects whether a staff member can log into the till while fully offline on day one (device never having synced before) or only after first sync.

---

## 12. Prompting Notes for Claude Code

Feed one phase at a time (Section 10) rather than the whole roadmap at once. Paste the relevant schema block (Section 5) and the specific component's spec (Section 6) into the prompt for that phase. Phase 0 should be handed to Claude Code alongside the *existing* DSS Prisma schema file (not just this doc's sketch) so the migration is additive and doesn't conflict with what's already been built.
