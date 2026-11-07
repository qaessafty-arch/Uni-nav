import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { Shell } from "@/components/Shell";

export const metadata: Metadata = {
  title: { default: "CAMPUS NAV Admin", template: "%s · CAMPUS NAV Admin" },
  robots: { index: false, follow: false },
  icons: { icon: [{ url: "/favicon-32.png", sizes: "32x32", type: "image/png" }, { url: "/icon.png", sizes: "192x192", type: "image/png" }], apple: "/icon.png" },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" dir="ltr" data-theme="light" data-style="minimal" suppressHydrationWarning>
      <head>
        {/* Apply the saved visual style before first paint (presentation only). */}
        <script dangerouslySetInnerHTML={{ __html: `try{var s=localStorage.getItem("campusnav.admin.style");if(["minimal","editorial","brutal"].indexOf(s)>-1)document.documentElement.dataset.style=s}catch(e){}` }} />
      </head>
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
