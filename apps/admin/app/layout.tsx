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
    <html lang="en" dir="ltr" data-theme="dark" data-style="editorial" suppressHydrationWarning>
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
