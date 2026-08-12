import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
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

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#07060d",
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Netgraph — Map your multi-platform network",
  description:
    "Add LinkedIn, Instagram, Facebook, TikTok, and Spotify handles. Explore visible interaction, audience, and taste as explainable graphs with analytics.",
  openGraph: {
    title: "Netgraph — Map your multi-platform network",
    description:
      "Visible interaction graphs and analytics across LinkedIn, Instagram, Facebook, TikTok, and Spotify.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Netgraph — Map your multi-platform network",
    description:
      "Visible interaction graphs and analytics across LinkedIn, Instagram, Facebook, TikTok, and Spotify.",
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
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
