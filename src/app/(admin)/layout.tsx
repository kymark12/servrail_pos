import { requirePosEntitlement } from "@/lib/entitlement";
import { AdminNav } from "@/components/admin/admin-nav";

// Tenant-admin shell. requirePosEntitlement() resolves the active business and
// redirects to /sign-in (no session) or /not-enabled (no ACTIVE POS entitlement).
// Server actions re-check the same gate as defense in depth.
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { business } = await requirePosEntitlement();

  return (
    <div className="min-h-screen bg-muted/20">
      <AdminNav businessName={business.name} />
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
