"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { savePrinterConfig } from "@/app/(admin)/printer/actions";

type Connection = "USB" | "BLUETOOTH";
export type PrinterDTO = {
  connectionType: Connection;
  vendorProductId: string | null;
  paperWidthMm: number;
  lastPairedAt: string | null;
};

export function PrinterForm({ config }: { config: PrinterDTO | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [connectionType, setConnectionType] = useState<Connection>(config?.connectionType ?? "USB");
  const [vendorProductId, setVendorProductId] = useState(config?.vendorProductId ?? "");
  const [paperWidthMm, setPaperWidthMm] = useState<number>(config?.paperWidthMm ?? 58);

  function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    startTransition(async () => {
      const res = await savePrinterConfig({ connectionType, vendorProductId, paperWidthMm });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Printer configuration saved");
      router.refresh();
    });
  }

  return (
    <form onSubmit={save} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Receipt printer</CardTitle>
          <CardDescription>
            {config?.lastPairedAt
              ? `Last paired ${new Date(config.lastPairedAt).toLocaleString()}`
              : "Not paired to a physical printer yet."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label>Connection</Label>
            <div className="flex gap-2">
              {(["USB", "BLUETOOTH"] as Connection[]).map((c) => (
                <Button
                  key={c}
                  type="button"
                  variant={connectionType === c ? "default" : "outline"}
                  onClick={() => setConnectionType(c)}
                >
                  {c === "USB" ? "USB" : "Bluetooth"}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              USB is the primary path for the prototype; Bluetooth is a fallback
              (BLE only).
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="vpid">USB vendor/product ID</Label>
            <Input
              id="vpid"
              value={vendorProductId}
              onChange={(e) => setVendorProductId(e.target.value)}
              placeholder="e.g. 0x0416:0x5011 (filled automatically when paired)"
              maxLength={64}
            />
            <p className="text-xs text-muted-foreground">
              Optional. Leave blank until the printer is paired — the plugin will
              capture this to reconnect to the same device.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Paper width</Label>
            <div className="flex gap-2">
              {[58, 80].map((w) => (
                <Button
                  key={w}
                  type="button"
                  variant={paperWidthMm === w ? "default" : "outline"}
                  onClick={() => setPaperWidthMm(w)}
                >
                  {w}mm
                </Button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save configuration"}
            </Button>
            {/* Phase 5 (WebUSB / ESC-POS) wires these up against a real printer. */}
            <Button type="button" variant="outline" disabled title="Available in the printer plugin (Phase 5)">
              Pair printer
            </Button>
            <Button type="button" variant="outline" disabled title="Available in the printer plugin (Phase 5)">
              Test print
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Pairing and test printing need the physical unit and the WebUSB plugin —
            coming in a later phase.
          </p>
        </CardContent>
      </Card>
    </form>
  );
}
