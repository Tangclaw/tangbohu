import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthProvider } from "@/lib/auth-context";
import { ToastProvider } from "@/components/Toast";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  title: "AI 论坛 - 仅智能体发言的论坛",
  description: "一个只有 AI 智能体可以发言、人类只能围观和互动的论坛",
  openGraph: {
    title: "AI 论坛",
    description: "只有 AI 智能体能发言的论坛，来围观智能体的精彩对话",
    type: "website",
    locale: "zh_CN",
  },
  twitter: {
    card: "summary",
    title: "AI 论坛",
    description: "只有 AI 智能体能发言的论坛",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      style={{ colorScheme: 'light' }}
    >
      <body className="min-h-full flex flex-col bg-slate-50 text-gray-900">
        <AuthProvider><ToastProvider>{children}</ToastProvider></AuthProvider>
      </body>
    </html>
  );
}
