import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

// Shown when a signed-in business does not have an ACTIVE POS entitlement.
// Enabling POS is an operator action in the back-office, not something the
// tenant can self-serve here.
export default function NotEnabledPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>POS is not enabled</CardTitle>
          <CardDescription>
            This business doesn&apos;t have the POS product turned on yet.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Contact your ServRail administrator to enable Point of Sale for your
            account.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
