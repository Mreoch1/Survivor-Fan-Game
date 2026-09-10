import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";
import { AuthSession } from "./components/AuthSession";

const sans = Geist({ variable: "--font-sans", subsets: ["latin"] });
const mono = Geist_Mono({ variable: "--font-mono", subsets: ["latin"] });

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const image = `${protocol}://${host}/og.png`;
  return { title: { default: "Outlast 51 Fantasy League", template: "%s · Outlast 51" }, description: "A private, family-and-friends fantasy league for Season 51.", icons: { icon: "/favicon.svg" }, openGraph: { title: "Outlast 51 Fantasy League", description: "Outpick. Outlast. Outscore.", images: [image] }, twitter: { card: "summary_large_image", title: "Outlast 51 Fantasy League", description: "Outpick. Outlast. Outscore.", images: [image] } };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" data-scroll-behavior="smooth"><body className={`${sans.variable} ${mono.variable}`}><AuthSession/>{children}</body></html>;
}
