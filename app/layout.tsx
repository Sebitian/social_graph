import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import AppShell from "@/components/AppShell";
import { listJobIndex } from "@/lib/jobs";
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
  title: "Starling — See the shape of your people",
  description:
    "Starling charts the visible network around any handle. Who shows up, what they share, and why the line is there.",
  openGraph: {
    title: "Starling — See the shape of your people",
    description:
      "A field guide to public networks across LinkedIn, Instagram, Facebook, TikTok, and Spotify.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Starling — See the shape of your people",
    description:
      "A field guide to public networks across LinkedIn, Instagram, Facebook, TikTok, and Spotify.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jobs = listJobIndex();
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}
      >
        <AppShell jobs={jobs}>{children}</AppShell>
      </body>
    </html>
  );
}
