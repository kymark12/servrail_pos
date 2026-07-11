import type { NextAuthConfig } from "next-auth";

// Edge-safe config (no Prisma / bcrypt) shared by the proxy (middleware) and the
// full server auth. The Credentials provider (which needs Prisma) is added only in
// src/lib/auth.ts. This is the tenant-facing (business owner/staff) session — the
// same identity model DSS uses. POS-till cashier PIN sessions are separate and
// device-local (Phase 2), not part of this Auth.js session.
export const authConfig = {
  pages: {
    signIn: "/sign-in",
  },
  providers: [],
  callbacks: {
    // Runs in the proxy for every matched (protected) route.
    authorized({ auth }) {
      return !!auth?.user;
    },
    jwt({ token, user }) {
      if (user) {
        token.activeBusinessId = user.activeBusinessId ?? null;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub as string;
        session.user.activeBusinessId =
          (token.activeBusinessId as string | null | undefined) ?? null;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
