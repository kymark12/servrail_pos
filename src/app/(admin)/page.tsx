import Link from "next/link";
import { requirePosEntitlement } from "@/lib/entitlement";
import { prisma } from "@/lib/db";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// Admin overview: at-a-glance counts + entry points. Everything here is scoped to
// the active business resolved by the entitlement gate.
export default async function AdminHome() {
  const { business } = await requirePosEntitlement();
  const businessId = business.id;

  const [categoryCount, itemCount, activeItemCount, staffCount, printer] =
    await Promise.all([
      prisma.menuCategory.count({ where: { businessId } }),
      prisma.menuItem.count({ where: { businessId } }),
      prisma.menuItem.count({ where: { businessId, isActive: true } }),
      prisma.staff.count({ where: { businessId, isActive: true } }),
      prisma.printerConfig.findUnique({ where: { businessId } }),
    ]);

  const cards = [
    {
      title: "Menu",
      href: "/menu",
      value: `${itemCount} item${itemCount === 1 ? "" : "s"}`,
      sub: `${categoryCount} categor${categoryCount === 1 ? "y" : "ies"} · ${activeItemCount} active`,
    },
    {
      title: "Staff",
      href: "/staff",
      value: `${staffCount} active`,
      sub: "PIN logins for the till",
    },
    {
      title: "Printer",
      href: "/printer",
      value: printer ? printer.connectionType : "Not set up",
      sub: printer ? `${printer.paperWidthMm}mm paper` : "Configure the receipt printer",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{business.name}</h1>
          <p className="text-muted-foreground">Point of Sale — setup &amp; configuration</p>
        </div>
        <Link href="/pos" className={buttonVariants({ size: "lg" })}>
          Open till →
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {cards.map((c) => (
          <Link key={c.href} href={c.href} className="block">
            <Card className="h-full transition-colors hover:border-foreground/20">
              <CardHeader>
                <CardDescription>{c.title}</CardDescription>
                <CardTitle className="text-2xl">{c.value}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{c.sub}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Getting started</CardTitle>
          <CardDescription>
            Set these up before opening the till. The cashier app (Phase 2) reads
            this configuration.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Link href="/menu" className={buttonVariants({ variant: "outline" })}>
            Build the menu
          </Link>
          <Link href="/staff" className={buttonVariants({ variant: "outline" })}>
            Add staff PINs
          </Link>
          <Link href="/printer" className={buttonVariants({ variant: "outline" })}>
            Configure printer
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
