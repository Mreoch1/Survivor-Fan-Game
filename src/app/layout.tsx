import type { Metadata } from "next";
import { Bitter, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeMusic } from "@/components/ThemeMusic";

const survivorSans = Bitter({
  variable: "--font-survivor-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Survivor Fan Game | Outwit, Outplay, Outlast",
  description: "Family and friends prediction game for Survivor Season 50. Pick the winner, vote each week, choose your tribe, earn points.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${survivorSans.variable} ${geistMono.variable} antialiased`}>
        {children}
        <ThemeMusic />
      </body>
    </html>
  );
}
