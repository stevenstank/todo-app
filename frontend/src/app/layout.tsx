import type { Metadata } from "next";
import localFont from "next/font/local";
import Navbar from "@root/components/layout/Navbar";
import RouteProgress from "@root/components/ui/RouteProgress";
import "./globals.css";

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
  title: "Todo App",
  description: "A clean and scalable Todo App layout",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-slate-50 text-slate-900 antialiased`}
      >
        <RouteProgress />
        <div className="min-h-screen">
          <Navbar />

          <main className="mx-auto w-full max-w-4xl p-4">{children}</main>
        </div>
      </body>
    </html>
  );
}
