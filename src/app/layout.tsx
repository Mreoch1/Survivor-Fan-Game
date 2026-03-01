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

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL || "https://survivor-fan-game.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Survivor Fan Game | Outwit, Outplay, Outlast",
  description:
    "Family and friends prediction game for Survivor Season 50. Pick the winner, vote each week, choose your tribe, earn points.",
  icons: {
    icon: "/image.png",
    apple: "/image.png",
  },
  openGraph: {
    title: "Survivor Fan Game | Outwit, Outplay, Outlast",
    description:
      "Family and friends prediction game for Survivor Season 50. Pick the winner, vote each week, choose your tribe, earn points.",
    url: "/",
    siteName: "Survivor Fan Game",
    images: [
      {
        url: "/image.png",
        width: 512,
        height: 512,
        alt: "Survivor 50: In the Hands of the Fans",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Survivor Fan Game | Outwit, Outplay, Outlast",
    description:
      "Family and friends prediction game for Survivor Season 50. Pick the winner, vote each week, choose your tribe, earn points.",
    images: ["/image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=localStorage.getItem("survivor-theme");if(t==="cila"||t==="kalo"||t==="vatu")document.documentElement.setAttribute("data-theme",t);})();`,
          }}
        />
      </head>
      <body className={`${survivorSans.variable} ${geistMono.variable} antialiased`}>
        {children}
        <ThemeMusic />
      </body>
    </html>
  );
}
