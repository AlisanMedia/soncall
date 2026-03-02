import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
import ErrorToast from "@/components/ui/ErrorToast";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#0B0E11' },
    { media: '(prefers-color-scheme: dark)', color: '#0B0E11' },
  ],
};

export const metadata: Metadata = {
  title: "ArtificAgent - AI-Powered Sales Platform",
  description: "Intelligent sales management platform for agents and managers",
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'ArtificAgent',
  },
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <Toaster richColors position="top-center" theme="dark" />
        <ErrorToast />
      </body>
    </html>
  );
}
