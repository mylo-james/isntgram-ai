import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import SessionProvider from "@/components/providers/SessionProvider";
import ReduxProvider from "@/components/providers/ReduxProvider";
import AuthProvider from "@/components/auth/AuthProvider";
import { Header } from "@/components/common/Header";

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
  viewport: "width=device-width, initial-scale=1",
  robots: "index, follow",
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
              <Header />
              <main>{children}</main>
            </AuthProvider>
          </SessionProvider>
        </ReduxProvider>
      </body>
    </html>
  );
}
