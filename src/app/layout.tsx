import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ServRail POS",
  description: "Touch-first point of sale for ServRail businesses",
  // iOS ignores the manifest's `display` field: without appleWebApp.capable the
  // home-screen icon just reopens Safari with its chrome. This is what makes the
  // installed till launch full-screen.
  appleWebApp: {
    capable: true,
    title: "ServRail",
    statusBarStyle: "default",
  },
  // Next only emits the standard <meta name="mobile-web-app-capable">. iPadOS still
  // looks for the apple- prefixed one to launch standalone; without it the installed
  // icon reopens Safari with its chrome. Harmless duplicate on other platforms.
  other: {
    "apple-mobile-web-app-capable": "yes",
  },
};

// Stops the till zooming/panning when a cashier double-taps a menu button, and
// keeps the layout under the iPad's notch/home indicator.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
