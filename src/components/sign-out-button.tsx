"use client";

import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";

export function SignOutButton() {
  return (
    <Button
      variant="outline"
      className="w-full"
      onClick={() => signOut({ callbackUrl: "/sign-in" })}
    >
      Sign out
    </Button>
  );
}
