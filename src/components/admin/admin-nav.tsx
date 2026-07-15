"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const links = [
  { href: "/", label: "Overview" },
  { href: "/menu", label: "Menu" },
  { href: "/staff", label: "Staff" },
  { href: "/printer", label: "Printer" },
];

export function AdminNav({ businessName }: { businessName: string }) {
  const pathname = usePathname();

  return (
    <header className="bg-sidebar text-sidebar-foreground">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-6 px-4">
        <Link href="/" className="font-heading text-lg font-semibold">
          ServRail <span className="text-sidebar-foreground/60">POS</span>
        </Link>
        <nav className="flex items-center gap-1">
          {links.map((link) => {
            const active =
              link.href === "/"
                ? pathname === "/"
                : pathname === link.href || pathname.startsWith(link.href + "/");
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm transition-colors",
                  active
                    ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-white/10 hover:text-sidebar-foreground",
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <span className="hidden text-sm text-sidebar-foreground/70 sm:inline">
            {businessName}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="text-sidebar-foreground hover:bg-white/10 hover:text-sidebar-foreground"
            onClick={() => signOut({ callbackUrl: "/sign-in" })}
          >
            Sign out
          </Button>
        </div>
      </div>
    </header>
  );
}
