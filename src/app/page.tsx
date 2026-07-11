import { redirect } from "next/navigation";
import { getActiveBusiness } from "@/lib/tenant";
import { hasPosEntitlement } from "@/lib/entitlement";
import { SignOutButton } from "@/components/sign-out-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// Phase 0 landing: confirms the tenant session resolves and shows POS entitlement
// status. Phase 1 replaces this with the real tenant-admin home.
export default async function Home() {
  const tenant = await getActiveBusiness();
  if (!tenant) redirect("/sign-in");

  const entitled = await hasPosEntitlement(tenant.business.id);

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>ServRail POS</CardTitle>
          <CardDescription>
            Signed in to <strong>{tenant.business.name}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">POS product</span>
            {entitled ? (
              <Badge>Enabled</Badge>
            ) : (
              <Badge variant="secondary">Not enabled</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Scaffold is live (Phase 0). Tenant admin — menu, staff, and printer
            setup — lands in Phase 1.
          </p>
          <SignOutButton />
        </CardContent>
      </Card>
    </main>
  );
}
