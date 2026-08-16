import "./globals.css";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ToastProvider } from "@/crm/components/ToastProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

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
    <div className={`${geistSans.variable} ${geistMono.variable} min-h-full flex flex-col font-sans antialiased`}>
      <ToastProvider>{children}</ToastProvider>
    </div>
  );
}
