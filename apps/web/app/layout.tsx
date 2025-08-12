import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import SessionProvider from "@/components/providers/SessionProvider";
import ReduxProvider from "@/components/providers/ReduxProvider";
import AuthProvider from "@/components/auth/AuthProvider";
import DemoBanner from "@/components/common/DemoBanner";
import SiteHeader from "@/components/common/SiteHeader";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Isntgram - AI-Powered Social Media",
  description: "Connect with meaningful content and conversations on Isntgram, the AI-powered social media platform.",
  keywords: ["social media", "AI", "connections", "content", "community"],
  authors: [{ name: "Isntgram Team" }],
  robots: "index, follow",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ReduxProvider>
          <SessionProvider>
            <AuthProvider>
              <DemoBanner />
              <SiteHeader />
              {children}
            </AuthProvider>
          </SessionProvider>
        </ReduxProvider>
      </body>
    </html>
  );
}
