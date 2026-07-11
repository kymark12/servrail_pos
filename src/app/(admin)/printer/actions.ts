"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { PrinterConnection } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requirePosEntitlement } from "@/lib/entitlement";

export type ActionResult = { ok: true } | { ok: false; error: string };

const schema = z.object({
  connectionType: z.nativeEnum(PrinterConnection),
  // Optional until the physical unit is paired (Phase 5 fills this from WebUSB).
  vendorProductId: z.string().trim().max(64).optional().or(z.literal("")),
  paperWidthMm: z.coerce.number().int().refine((n) => n === 58 || n === 80, "Paper width must be 58 or 80mm"),
});

// One printer config per business (single till, v1). Upsert on the unique businessId.
export async function savePrinterConfig(input: unknown): Promise<ActionResult> {
  const { business } = await requirePosEntitlement();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };

  const vendorProductId = parsed.data.vendorProductId?.trim() || null;

  await prisma.printerConfig.upsert({
    where: { businessId: business.id },
    create: {
      businessId: business.id,
      connectionType: parsed.data.connectionType,
      vendorProductId,
      paperWidthMm: parsed.data.paperWidthMm,
    },
    update: {
      connectionType: parsed.data.connectionType,
      vendorProductId,
      paperWidthMm: parsed.data.paperWidthMm,
    },
  });
  revalidatePath("/printer");
  return { ok: true };
}
