import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export type PersistLine = {
  menuItemId: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
};
export type PersistOrderInput = {
  localOrderId: string;
  staffId: string;
  soldAt: Date;
  lines: PersistLine[];
};

/**
 * Idempotently persist one POS order: the Order + OrderItems, plus the POS→DSS
 * join — one SalesUpload(source=POS) and one SalesRecord per line so the sale
 * lands in the shared dataset. Keyed on (businessId, localOrderId): a replayed
 * sync returns the existing order without creating a second SalesRecord.
 *
 * The line name/price are the client's sale-time snapshot (offline can't re-price
 * against the live menu) — recorded verbatim, which is also what the receipt shows.
 */
export async function persistPosOrder(
  businessId: string,
  input: PersistOrderInput,
): Promise<{ orderId: string; created: boolean }> {
  const existing = await prisma.order.findUnique({
    where: { businessId_localOrderId: { businessId, localOrderId: input.localOrderId } },
    select: { id: true },
  });
  if (existing) return { orderId: existing.id, created: false };

  try {
    const orderId = await prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          businessId,
          staffId: input.staffId,
          localOrderId: input.localOrderId,
          status: "SYNCED",
          syncedAt: new Date(),
          items: {
            create: input.lines.map((l) => ({
              menuItemId: l.menuItemId,
              itemName: l.itemName,
              quantity: l.quantity,
              unitPrice: new Prisma.Decimal(l.unitPrice),
            })),
          },
        },
      });

      const upload = await tx.salesUpload.create({
        data: {
          businessId,
          fileName: `POS order ${input.localOrderId}`,
          source: "POS",
          status: "COMMITTED",
          rowCount: input.lines.length,
        },
      });
      await tx.salesRecord.createMany({
        data: input.lines.map((l) => ({
          businessId,
          uploadId: upload.id,
          saleDate: input.soldAt,
          itemName: l.itemName,
          quantity: l.quantity,
          unitPrice: new Prisma.Decimal(l.unitPrice),
          totalAmount: new Prisma.Decimal(l.unitPrice * l.quantity),
          paymentMethod: "CASH",
        })),
      });

      return order.id;
    });
    return { orderId, created: true };
  } catch (e) {
    // Two concurrent syncs of the same localOrderId — one lost the unique-index
    // race. Treat as already-synced.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const row = await prisma.order.findUnique({
        where: { businessId_localOrderId: { businessId, localOrderId: input.localOrderId } },
        select: { id: true },
      });
      if (row) return { orderId: row.id, created: false };
    }
    throw e;
  }
}
