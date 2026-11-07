import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: { default: "CAMPUS NAV", template: "%s · CAMPUS NAV" },
  description: "Find your lecture room, find your lecturer, and navigate there. A NULL-TECH product.",
  applicationName: "CAMPUS NAV",
  appleWebApp: { capable: true, title: "CAMPUS NAV", statusBarStyle: "black-translucent" },
  icons: { icon: [{ url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" }, { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }], apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#F6F7F9",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

const PREPAINT = `try{var p=JSON.parse(localStorage.getItem("campusnav.prefs")||"{}"),d=document.documentElement;if(["minimal","editorial","brutal"].indexOf(p.style)>-1)d.dataset.style=p.style;if(p.theme==="light"||p.theme==="dark")d.dataset.theme=p.theme;if(p.locale==="ar"||p.locale==="ckb"){d.dir="rtl";d.lang=p.locale}}catch(e){}`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" dir="ltr" data-theme="light" data-style="minimal" suppressHydrationWarning>
      <head>
        {/* Apply the saved visual style/theme before first paint (presentation only). */}
        <script dangerouslySetInnerHTML={{ __html: PREPAINT }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
