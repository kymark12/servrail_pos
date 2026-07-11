import { requirePosEntitlement } from "@/lib/entitlement";
import { prisma } from "@/lib/db";
import { PrinterForm, type PrinterDTO } from "@/components/admin/printer-form";

export default async function PrinterPage() {
  const { business } = await requirePosEntitlement();

  const config = await prisma.printerConfig.findUnique({
    where: { businessId: business.id },
  });

  const dto: PrinterDTO | null = config
    ? {
        connectionType: config.connectionType,
        vendorProductId: config.vendorProductId,
        paperWidthMm: config.paperWidthMm,
        lastPairedAt: config.lastPairedAt?.toISOString() ?? null,
      }
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Printer</h1>
        <p className="text-muted-foreground">
          Which thermal printer the till prints receipts to. This is configuration
          only — pairing and test prints arrive with the printer plugin.
        </p>
      </div>
      <PrinterForm config={dto} />
    </div>
  );
}
