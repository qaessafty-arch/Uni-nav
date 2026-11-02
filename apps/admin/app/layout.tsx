import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { Shell } from "@/components/Shell";

export const metadata: Metadata = {
  title: { default: "CAMPUS NAV Admin", template: "%s · CAMPUS NAV Admin" },
  robots: { index: false, follow: false },
  icons: { icon: "/icon.png" },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" dir="ltr" data-theme="dark">
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
