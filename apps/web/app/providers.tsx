"use client";
import { useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AppProvider } from "@/lib/store";
import { AppShell } from "@/components/AppShell";
import { ReminderScheduler } from "@/components/ReminderScheduler";

const BARE_ROUTES = ["/onboarding", "/campus"];

export function Providers({ children }: { children: ReactNode }) {
  const path = usePathname();
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        /* PWA install is optional */
      });
    }
  }, []);
  const bare = BARE_ROUTES.some((r) => path.startsWith(r));
  return (
    <AppProvider>
      <ReminderScheduler />
      {bare ? <main id="main">{children}</main> : <AppShell>{children}</AppShell>}
    </AppProvider>
  );
}
