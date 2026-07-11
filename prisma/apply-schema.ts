/**
 * Idempotent schema apply for the SHARED Neon database.
 *
 * DSS owns the primary migration history for the shared DB. To avoid two Prisma
 * projects fighting over `_prisma_migrations` (and to avoid `migrate dev` offering
 * to reset the shared DB), POS applies ONLY its own additive changes here with
 * plain, re-runnable DDL:
 *   • POS-owned enums:  StaffRole, OrderStatus, PrinterConnection
 *   • POS-owned tables: Staff, MenuCategory, MenuItem, Order, OrderItem, PrinterConfig
 *   • One value added to the DSS-owned UploadSource enum: 'POS'
 *
 * The 'POS' UploadSource value is DSS-owned territory; ideally DSS lands it as a
 * one-line migration too. The guarded ADD VALUE below keeps POS setup self-
 * sufficient and is a no-op once the value exists.
 *
 * Safe to run any number of times. Run with: npm run db:apply
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

// Use the DIRECT (non-pooled) connection for DDL — PgBouncer transaction pooling
// doesn't play well with CREATE TYPE / ALTER TYPE / advisory-lock statements.
const prisma = new PrismaClient({
  datasourceUrl: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
});

// Each statement runs on its own — DDL is not batched through one query.
const DDL: string[] = [
  // ── Enums (guarded — CREATE TYPE has no IF NOT EXISTS) ──────────────────────
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StaffRole') THEN
       CREATE TYPE "StaffRole" AS ENUM ('CASHIER', 'MANAGER');
     END IF;
   END $$`,
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OrderStatus') THEN
       CREATE TYPE "OrderStatus" AS ENUM ('QUEUED', 'SYNCED', 'FAILED');
     END IF;
   END $$`,
  `DO $$ BEGIN
     IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PrinterConnection') THEN
       CREATE TYPE "PrinterConnection" AS ENUM ('USB', 'BLUETOOTH');
     END IF;
   END $$`,

  // ── Extend the DSS-owned UploadSource enum with POS (no-op if present) ───────
  `ALTER TYPE "UploadSource" ADD VALUE IF NOT EXISTS 'POS'`,

  // ── Staff ───────────────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS "Staff" (
     "id"         TEXT NOT NULL,
     "businessId" TEXT NOT NULL,
     "name"       TEXT NOT NULL,
     "pinHash"    TEXT NOT NULL,
     "role"       "StaffRole" NOT NULL DEFAULT 'CASHIER',
     "isActive"   BOOLEAN NOT NULL DEFAULT true,
     "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
     CONSTRAINT "Staff_pkey" PRIMARY KEY ("id"),
     CONSTRAINT "Staff_businessId_fkey" FOREIGN KEY ("businessId")
       REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE
   )`,
  `CREATE INDEX IF NOT EXISTS "Staff_businessId_idx" ON "Staff"("businessId")`,

  // ── MenuCategory ──────────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS "MenuCategory" (
     "id"         TEXT NOT NULL,
     "businessId" TEXT NOT NULL,
     "name"       TEXT NOT NULL,
     "sortOrder"  INTEGER NOT NULL DEFAULT 0,
     "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
     CONSTRAINT "MenuCategory_pkey" PRIMARY KEY ("id"),
     CONSTRAINT "MenuCategory_businessId_fkey" FOREIGN KEY ("businessId")
       REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE
   )`,
  `CREATE INDEX IF NOT EXISTS "MenuCategory_businessId_idx" ON "MenuCategory"("businessId")`,

  // ── MenuItem ──────────────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS "MenuItem" (
     "id"         TEXT NOT NULL,
     "businessId" TEXT NOT NULL,
     "categoryId" TEXT NOT NULL,
     "name"       TEXT NOT NULL,
     "price"      DECIMAL(12,2) NOT NULL,
     "isActive"   BOOLEAN NOT NULL DEFAULT true,
     "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
     CONSTRAINT "MenuItem_pkey" PRIMARY KEY ("id"),
     CONSTRAINT "MenuItem_categoryId_fkey" FOREIGN KEY ("categoryId")
       REFERENCES "MenuCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE
   )`,
  `CREATE INDEX IF NOT EXISTS "MenuItem_businessId_idx" ON "MenuItem"("businessId")`,
  `CREATE INDEX IF NOT EXISTS "MenuItem_categoryId_idx" ON "MenuItem"("categoryId")`,

  // ── Order (table name is a reserved word — always quoted) ────────────────────
  `CREATE TABLE IF NOT EXISTS "Order" (
     "id"           TEXT NOT NULL,
     "businessId"   TEXT NOT NULL,
     "staffId"      TEXT NOT NULL,
     "localOrderId" TEXT NOT NULL,
     "status"       "OrderStatus" NOT NULL DEFAULT 'QUEUED',
     "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
     "syncedAt"     TIMESTAMP(3),
     CONSTRAINT "Order_pkey" PRIMARY KEY ("id"),
     CONSTRAINT "Order_businessId_localOrderId_key" UNIQUE ("businessId", "localOrderId"),
     CONSTRAINT "Order_businessId_fkey" FOREIGN KEY ("businessId")
       REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE,
     CONSTRAINT "Order_staffId_fkey" FOREIGN KEY ("staffId")
       REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE
   )`,
  `CREATE INDEX IF NOT EXISTS "Order_businessId_status_idx" ON "Order"("businessId", "status")`,

  // ── OrderItem ─────────────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS "OrderItem" (
     "id"         TEXT NOT NULL,
     "orderId"    TEXT NOT NULL,
     "menuItemId" TEXT NOT NULL,
     "itemName"   TEXT NOT NULL,
     "quantity"   INTEGER NOT NULL,
     "unitPrice"  DECIMAL(12,2) NOT NULL,
     CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id"),
     CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId")
       REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE
   )`,
  `CREATE INDEX IF NOT EXISTS "OrderItem_orderId_idx" ON "OrderItem"("orderId")`,

  // ── PrinterConfig (one per business for the v1 single-till prototype) ─────────
  `CREATE TABLE IF NOT EXISTS "PrinterConfig" (
     "id"              TEXT NOT NULL,
     "businessId"      TEXT NOT NULL,
     "connectionType"  "PrinterConnection" NOT NULL DEFAULT 'USB',
     "vendorProductId" TEXT,
     "paperWidthMm"    INTEGER NOT NULL DEFAULT 58,
     "lastPairedAt"    TIMESTAMP(3),
     CONSTRAINT "PrinterConfig_pkey" PRIMARY KEY ("id"),
     CONSTRAINT "PrinterConfig_businessId_key" UNIQUE ("businessId"),
     CONSTRAINT "PrinterConfig_businessId_fkey" FOREIGN KEY ("businessId")
       REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE
   )`,
];

async function main() {
  console.log("→ Applying POS schema to shared DB (POS-owned tables only)…");
  for (const statement of DDL) {
    await prisma.$executeRawUnsafe(statement);
  }
  console.log("✓ POS enums / tables ensured. DSS tables untouched.");
}

main()
  .catch((e) => {
    console.error("✗ apply-schema failed:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
