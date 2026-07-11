import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      activeBusinessId: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    activeBusinessId?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    activeBusinessId?: string | null;
  }
}
