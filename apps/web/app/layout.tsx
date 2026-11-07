import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { Providers } from "./providers";
import { Analytics } from "@vercel/analytics/next";

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://uni-nav.online";
const DESCRIPTION = "Find your room, your timetable and your lecture files. Campus map, indoor directions and free rooms. A student project by NULL-TECH.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: "UNI NAV", template: "%s · UNI NAV" },
  description: DESCRIPTION,
  openGraph: { type: "website", siteName: "UNI NAV", title: "UNI NAV: find your room and your class", description: DESCRIPTION, url: SITE },
  twitter: { card: "summary_large_image", title: "UNI NAV: find your room and your class", description: DESCRIPTION },
  applicationName: "UNI NAV",
  appleWebApp: { capable: true, title: "UNI NAV", statusBarStyle: "black-translucent" },
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
        {/* Page-view counts only (no cookies, no personal data); ?ref= tags show which channel people came from. */}
        <Analytics />
      </body>
    </html>
  );
}
