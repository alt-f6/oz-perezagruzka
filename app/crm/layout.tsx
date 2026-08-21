import "./globals.css";
import type { Metadata } from "next";
import { ToastProvider } from "@/crm/components/ToastProvider";

export const metadata: Metadata = {
  title: "CRM учебного центра",
  description: "CRM для центра репетиторства по математике",
};

// Structural wrapper only. <html>/<body> live in the single root app/layout.tsx.
export default function CrmLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-full flex flex-col font-sans antialiased">
      <ToastProvider>{children}</ToastProvider>
    </div>
  );
}
