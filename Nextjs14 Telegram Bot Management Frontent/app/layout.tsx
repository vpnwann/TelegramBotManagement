import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { ToastProvider } from "@/components/Toast";

export const metadata: Metadata = {
  title: "Telegram Bot Admin",
  description: "Admin panel for the Telegram Bot Admin API",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="flex h-full min-h-screen">
        <ToastProvider>
          <Sidebar />
          <main className="min-w-0 flex-1 overflow-y-auto">
            <div className="mx-auto max-w-6xl px-8 py-8">{children}</div>
          </main>
        </ToastProvider>
      </body>
    </html>
  );
}
