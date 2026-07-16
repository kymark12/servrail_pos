"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowLeft, Delete, Minus, Plus, Trash2, X, ShoppingCart, Wifi, WifiOff } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/format";
import { ServiceWorkerRegister } from "@/components/pos/sw-register";
import { verifyPin } from "@/lib/pos/auth";
import {
  cacheMenu,
  cacheStaff,
  clearSession,
  getSession,
  queueOrder,
} from "@/lib/pos/db";
import { useOrderSync } from "@/lib/pos/use-order-sync";
import type {
  LocalOrder,
  MenuData,
  MenuItem,
  PosSession,
  StaffCredential,
} from "@/lib/pos/types";

export type { MenuData, MenuItem } from "@/lib/pos/types";

type CartLine = { item: MenuItem; qty: number };
type ReceiptLine = { name: string; quantity: number; lineTotal: number };
type ReceiptData = {
  orderId: string;
  staffName: string;
  soldAt: string;
  total: number;
  lines: ReceiptLine[];
};

export function Till({
  businessId,
  businessName,
  currency,
  menu,
  staffCredentials,
}: {
  businessId: string;
  businessName: string;
  currency: string;
  menu: MenuData;
  staffCredentials: StaffCredential[];
}) {
  // `undefined` = still loading the local session; null = clocked out.
  const [staff, setStaff] = useState<PosSession | null | undefined>(undefined);

  // Cache the catalog + staff for offline use, then resolve who's on shift from
  // the device-local session (survives reloads and works fully offline).
  useEffect(() => {
    let alive = true;
    (async () => {
      await Promise.all([
        cacheMenu({ businessId, currency, categories: menu }),
        cacheStaff(businessId, staffCredentials),
      ]);
      const session = await getSession();
      if (alive) setStaff(session && session.businessId === businessId ? session : null);
    })();
    return () => {
      alive = false;
    };
  }, [businessId, currency, menu, staffCredentials]);

  return (
    <>
      <ServiceWorkerRegister />
      {staff === undefined ? (
        <div className="flex min-h-screen items-center justify-center bg-muted/30" />
      ) : staff === null ? (
        <PinPad businessName={businessName} onClockIn={setStaff} />
      ) : (
        <Register
          businessId={businessId}
          currency={currency}
          menu={menu}
          staff={staff}
          onClockOut={async () => {
            await clearSession();
            setStaff(null);
          }}
        />
      )}
    </>
  );
}

// ── PIN clock-in ──────────────────────────────────────────────────────────────
function PinPad({
  businessName,
  onClockIn,
}: {
  businessName: string;
  onClockIn: (s: PosSession) => void;
}) {
  const [pin, setPin] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(value: string) {
    setPending(true);
    // Verified against locally-cached hashes, so clock-in works offline.
    const session = await verifyPin(value);
    setPending(false);
    if (!session) {
      toast.error("PIN not recognized.");
      setPin("");
      return;
    }
    toast.success(`Welcome, ${session.staffName}`);
    onClockIn(session);
  }

  function press(digit: string) {
    if (pin.length >= 6) return;
    setPin(pin + digit);
  }

  const canSubmit = /^\d{4,6}$/.test(pin);
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-muted/30 p-6">
      <div className="text-center">
        <h1 className="text-xl font-semibold">{businessName}</h1>
        <p className="text-muted-foreground">Enter your PIN to start</p>
      </div>

      <div className="flex gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <span
            key={i}
            className={cn(
              "size-4 rounded-full border-2",
              i < pin.length ? "border-primary bg-primary" : "border-muted-foreground/30",
            )}
          />
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3">
        {keys.map((k) => (
          <button
            key={k}
            type="button"
            disabled={pending}
            onClick={() => press(k)}
            className="size-20 rounded-2xl border bg-card text-2xl font-medium shadow-xs transition-colors hover:bg-muted active:bg-muted disabled:opacity-50"
          >
            {k}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setPin("")}
          className="size-20 rounded-2xl text-sm text-muted-foreground hover:bg-muted"
        >
          Clear
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => press("0")}
          className="size-20 rounded-2xl border bg-card text-2xl font-medium shadow-xs transition-colors hover:bg-muted active:bg-muted disabled:opacity-50"
        >
          0
        </button>
        <button
          type="button"
          onClick={() => setPin((p) => p.slice(0, -1))}
          className="flex size-20 items-center justify-center rounded-2xl text-muted-foreground hover:bg-muted"
        >
          <Delete className="size-6" />
        </button>
      </div>

      <Button
        className="h-12 w-64 text-base"
        disabled={pending || !canSubmit}
        onClick={() => submit(pin)}
      >
        {pending ? "Checking…" : "Enter"}
      </Button>

      {/* Clocking out lands here, so this is the till's real exit. */}
      <Link
        href="/"
        className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-1.5")}
      >
        <ArrowLeft className="size-4" />
        Back to dashboard
      </Link>
    </div>
  );
}

// ── Sync status pill ──────────────────────────────────────────────────────────
function SyncBadge({
  online,
  queued,
  syncing,
}: {
  online: boolean;
  queued: number;
  syncing: boolean;
}) {
  const offline = !online;
  const label = syncing
    ? "Syncing…"
    : offline
      ? queued > 0
        ? `Offline · ${queued} queued`
        : "Offline"
      : queued > 0
        ? `${queued} to sync`
        : "All synced";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        offline || queued > 0
          ? "bg-white/15 text-sidebar-foreground"
          : "bg-white/10 text-sidebar-foreground/80",
      )}
      title={offline ? "No connection — sales are saved on this device" : undefined}
    >
      {offline ? <WifiOff className="size-3.5" /> : <Wifi className="size-3.5" />}
      {label}
    </span>
  );
}

// ── Register (selling screen) ─────────────────────────────────────────────────
function Register({
  businessId,
  currency,
  menu,
  staff,
  onClockOut,
}: {
  businessId: string;
  currency: string;
  menu: MenuData;
  staff: PosSession;
  onClockOut: () => void | Promise<void>;
}) {
  const [activeCat, setActiveCat] = useState(menu[0]?.id ?? "");
  const [cart, setCart] = useState<Map<string, CartLine>>(new Map());
  const [cartOpen, setCartOpen] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [pending, startTransition] = useTransition();
  const { online, queued, syncing, refresh, sync } = useOrderSync();

  const category = menu.find((c) => c.id === activeCat) ?? menu[0];

  const { count, total } = useMemo(() => {
    let count = 0;
    let total = 0;
    for (const { item, qty } of cart.values()) {
      count += qty;
      total += item.price * qty;
    }
    return { count, total };
  }, [cart]);

  function addItem(item: MenuItem) {
    setCart((prev) => {
      const next = new Map(prev);
      const existing = next.get(item.id);
      next.set(item.id, { item, qty: (existing?.qty ?? 0) + 1 });
      return next;
    });
  }

  function setQty(itemId: string, qty: number) {
    setCart((prev) => {
      const next = new Map(prev);
      if (qty <= 0) next.delete(itemId);
      else {
        const line = next.get(itemId);
        if (line) next.set(itemId, { ...line, qty });
      }
      return next;
    });
  }

  function clearCart() {
    setCart(new Map());
  }

  // Local-first checkout: write the sale to IndexedDB and show the receipt
  // immediately — no network needed. A background sync flushes it to the server.
  function charge() {
    const cartLines = Array.from(cart.values());
    if (cartLines.length === 0) return;

    const lines = cartLines.map((l) => ({
      menuItemId: l.item.id,
      itemName: l.item.name,
      quantity: l.qty,
      unitPrice: l.item.price,
    }));
    const localOrderId = crypto.randomUUID();
    const soldAt = new Date().toISOString();
    const order: LocalOrder = {
      localOrderId,
      businessId,
      staffId: staff.staffId,
      staffName: staff.staffName,
      soldAt,
      currency,
      total,
      lines,
      status: "queued",
    };

    startTransition(async () => {
      await queueOrder(order);
      setReceipt({
        orderId: localOrderId,
        staffName: staff.staffName,
        soldAt,
        total,
        lines: lines.map((l) => ({
          name: l.itemName,
          quantity: l.quantity,
          lineTotal: l.unitPrice * l.quantity,
        })),
      });
      clearCart();
      setCartOpen(false);
      await refresh();
      void sync(); // best-effort immediate push; retried on interval if offline
    });
  }

  const cartLines = Array.from(cart.values());

  return (
    <div className="flex h-screen flex-col bg-muted/20">
      {/* Header */}
      <header className="flex items-center justify-between gap-3 bg-sidebar px-4 py-2 text-sidebar-foreground">
        <div className="flex min-w-0 items-center gap-2">
          {/* The till is a standalone route (no AdminNav), and in a home-screen PWA
              there is no URL bar — without this the owner cannot leave the till. */}
          <Link
            href="/"
            className={cn(
              buttonVariants({ variant: "ghost", size: "sm" }),
              "gap-1.5 text-sidebar-foreground hover:bg-white/10 hover:text-sidebar-foreground",
            )}
          >
            <ArrowLeft className="size-4" />
            <span className="hidden sm:inline">Dashboard</span>
          </Link>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight">Cashier: {staff.staffName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <SyncBadge online={online} queued={queued} syncing={syncing} />
          <Button
            variant="ghost"
            size="sm"
            className="text-sidebar-foreground hover:bg-white/10 hover:text-sidebar-foreground"
            onClick={() => void onClockOut()}
          >
            Clock out
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Menu */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Category tabs */}
          <div className="flex gap-2 overflow-x-auto border-b bg-background px-3 py-2">
            {menu.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setActiveCat(c.id)}
                className={cn(
                  "shrink-0 rounded-full px-4 py-1.5 text-sm transition-colors",
                  c.id === activeCat
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/70",
                )}
              >
                {c.name}
              </button>
            ))}
          </div>
          {/* Item grid */}
          <div className="grid flex-1 auto-rows-min grid-cols-2 gap-3 overflow-y-auto p-3 sm:grid-cols-3 lg:grid-cols-4">
            {category?.items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => addItem(item)}
                className="flex h-24 flex-col justify-between rounded-xl border bg-card p-3 text-left shadow-xs transition-colors hover:border-primary/40 hover:bg-muted/40 active:bg-muted"
              >
                <span className="line-clamp-2 text-sm font-medium">{item.name}</span>
                <span className="text-sm text-muted-foreground">
                  {formatMoney(item.price, currency)}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Cart — desktop sidebar */}
        <aside className="hidden w-80 flex-col border-l bg-background md:flex">
          <CartPanel
            currency={currency}
            lines={cartLines}
            total={total}
            pending={pending}
            onSetQty={setQty}
            onClear={clearCart}
            onCharge={charge}
          />
        </aside>
      </div>

      {/* Cart — mobile bottom bar */}
      {count > 0 && (
        <button
          type="button"
          onClick={() => setCartOpen(true)}
          className="flex items-center justify-between gap-3 border-t bg-primary px-4 py-3 text-primary-foreground md:hidden"
        >
          <span className="flex items-center gap-2">
            <ShoppingCart className="size-5" />
            {count} item{count === 1 ? "" : "s"}
          </span>
          <span className="font-semibold">{formatMoney(total, currency)}</span>
        </button>
      )}

      {/* Cart — mobile overlay */}
      {cartOpen && (
        <div className="fixed inset-0 z-40 flex flex-col bg-background md:hidden">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <span className="font-semibold">Order</span>
            <button type="button" onClick={() => setCartOpen(false)}>
              <X className="size-5" />
            </button>
          </div>
          <CartPanel
            currency={currency}
            lines={cartLines}
            total={total}
            pending={pending}
            onSetQty={setQty}
            onClear={clearCart}
            onCharge={charge}
          />
        </div>
      )}

      {/* Receipt */}
      {receipt && (
        <Receipt
          receipt={receipt}
          currency={currency}
          onNewOrder={() => setReceipt(null)}
        />
      )}
    </div>
  );
}

function CartPanel({
  currency,
  lines,
  total,
  pending,
  onSetQty,
  onClear,
  onCharge,
}: {
  currency: string;
  lines: CartLine[];
  total: number;
  pending: boolean;
  onSetQty: (itemId: string, qty: number) => void;
  onClear: () => void;
  onCharge: () => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between px-4 py-3">
        <span className="font-semibold">Order</span>
        {lines.length > 0 && (
          <button type="button" onClick={onClear} className="text-xs text-muted-foreground hover:text-foreground">
            Clear
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4">
        {lines.length === 0 ? (
          <p className="pt-8 text-center text-sm text-muted-foreground">
            Tap items to add them.
          </p>
        ) : (
          lines.map(({ item, qty }) => (
            <div key={item.id} className="flex items-center gap-2 rounded-lg border p-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{item.name}</p>
                <p className="text-xs text-muted-foreground">{formatMoney(item.price, currency)}</p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onSetQty(item.id, qty - 1)}
                  className="flex size-7 items-center justify-center rounded-md border hover:bg-muted"
                >
                  {qty === 1 ? <Trash2 className="size-3.5 text-destructive" /> : <Minus className="size-3.5" />}
                </button>
                <span className="w-6 text-center text-sm tabular-nums">{qty}</span>
                <button
                  type="button"
                  onClick={() => onSetQty(item.id, qty + 1)}
                  className="flex size-7 items-center justify-center rounded-md border hover:bg-muted"
                >
                  <Plus className="size-3.5" />
                </button>
              </div>
              <span className="w-16 text-right text-sm tabular-nums">
                {formatMoney(item.price * qty, currency)}
              </span>
            </div>
          ))
        )}
      </div>

      <div className="border-t p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Total</span>
          <span className="text-xl font-semibold tabular-nums">{formatMoney(total, currency)}</span>
        </div>
        <Button
          className="h-12 w-full text-base"
          disabled={pending || lines.length === 0}
          onClick={onCharge}
        >
          {pending ? "Saving…" : `Charge ${formatMoney(total, currency)} · Cash`}
        </Button>
      </div>
    </div>
  );
}

// ── Receipt ───────────────────────────────────────────────────────────────────
function Receipt({
  receipt,
  currency,
  onNewOrder,
}: {
  receipt: ReceiptData;
  currency: string;
  onNewOrder: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-sm flex-col rounded-2xl bg-background shadow-lg">
        <div className="px-5 pt-5 text-center">
          <div className="mx-auto mb-2 flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            ✓
          </div>
          <p className="font-semibold">Paid — Cash</p>
          <p className="text-xs text-muted-foreground">
            {receipt.staffName} · {new Date(receipt.soldAt).toLocaleString()}
          </p>
        </div>

        <div className="min-h-0 flex-1 space-y-1 overflow-y-auto px-5 py-4">
          {receipt.lines.map((l, i) => (
            <div key={i} className="flex justify-between text-sm">
              <span className="min-w-0 flex-1 truncate">
                {l.quantity}× {l.name}
              </span>
              <span className="tabular-nums">{formatMoney(l.lineTotal, currency)}</span>
            </div>
          ))}
          <div className="mt-2 flex justify-between border-t pt-2 font-semibold">
            <span>Total</span>
            <span className="tabular-nums">{formatMoney(receipt.total, currency)}</span>
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t p-4">
          <Button variant="outline" disabled title="Available with the printer plugin (Phase 5)">
            Print receipt
          </Button>
          <Button className="h-11" onClick={onNewOrder}>
            New order
          </Button>
        </div>
      </div>
    </div>
  );
}
