import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Proxy (Next 16's rename of "middleware") uses only the edge-safe config (no
// Prisma). The `authorized` callback gates every matched route below; pages and
// server actions re-check tenant + entitlement server-side as defense in depth.
export default NextAuth(authConfig).auth;

export const config = {
  matcher: [
    // Protect everything except the sign-in page, auth API, the till PIN entry,
    // the PWA shell assets, and static assets.
    "/((?!sign-in|not-enabled|pos|manifest.webmanifest|sw.js|api/auth|_next/static|_next/image|favicon.ico).*)",
  ],
};
