import type { Metadata, Viewport } from "next";
import { Sora, Quicksand } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { DemoBanner } from "@/components/demo-banner";
import { OneSignalProvider } from "@/components/onesignal-provider";
import { OneSignalHead } from "@/components/onesignal-head";
import { NotificationPrompt } from "@/components/notification-prompt";
import { isDemoMode } from "@/lib/demo-mode";

const fontHeading = Sora({ subsets: ['latin'], variable: '--font-heading' });
const fontSans = Quicksand({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: "Frame First",
  description: "Conversion intelligence dashboard",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Frame First",
  },
};

export const viewport: Viewport = {
  themeColor: "#4f46e5",
  viewportFit: "cover",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn("font-sans", fontSans.variable, fontHeading.variable)}>
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <OneSignalHead />
      </head>
      <body className={fontSans.variable}>
        {isDemoMode() ? <DemoBanner /> : null}
        <OneSignalProvider>
          {children}
          {!isDemoMode() ? <NotificationPrompt /> : null}
        </OneSignalProvider>
      </body>
    </html>
  );
}
