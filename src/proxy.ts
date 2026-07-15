import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// Proxy (Next 16's rename of "middleware") uses only the edge-safe config (no
// Prisma). The `authorized` callback gates every matched route below; pages and
// server actions re-check tenant + entitlement server-side as defense in depth.
export default NextAuth(authConfig).auth;

export const config = {
  matcher: [
    // Protect everything except the sign-in page, the not-enabled notice, the auth
    // API, and static assets. The till (/pos) IS protected: for this online-first
    // build it runs behind the owner session; a device-local PIN then selects the
    // active cashier. (Offline-first PIN-only entry comes with the PWA pass.)
    //
    // manifest.webmanifest / icon / apple-icon must stay public: iOS fetches them
    // when installing to the home screen, and a gated manifest returns the sign-in
    // page instead — the install then gets no icon and no standalone mode. They
    // expose nothing but the app's name and logo.
    "/((?!sign-in|not-enabled|api/auth|manifest.webmanifest|icon|apple-icon|sw.js|_next/static|_next/image|favicon.ico).*)",
  ],
};
