import type { Metadata } from "next";
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

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Netgraph - See your Instagram network, visualized",
  description:
    "Drop in an Instagram handle and explore visible public interaction patterns as an explainable graph.",
  openGraph: {
    title: "See your Instagram network, visualized",
    description:
      "Explore visible Instagram interaction patterns as an explainable graph.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "See your Instagram network, visualized",
    description:
      "Explore visible Instagram interaction patterns as an explainable graph.",
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
