import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import UpdateNotification from "@/components/UpdateNotification";

const inter = Inter({
  subsets: ["latin"],
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "Liquid Glass Clock",
  description: "A beautiful animated real-time clock with liquid glass aesthetics",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="cs" className="h-full">
      <body className={`${inter.className} antialiased h-full`}>
        <UpdateNotification />
        {children}
      </body>
    </html>
  );
}
