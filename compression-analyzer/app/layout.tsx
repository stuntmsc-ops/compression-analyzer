import type { Metadata } from "next";
import "./globals.css";
import Providers from "@/components/Providers";
import WebApplicationJsonLd from "@/components/WebApplicationJsonLd";
import { getSiteUrl } from "@/lib/siteUrl";
import { Analytics } from "@vercel/analytics/next";

const siteUrl = getSiteUrl();
const title = "Stop Guessing Your Compression Settings | Compression Analyzer";
const description =
  "Upload a clip and get personalized compressor settings (ratio, attack, release, and threshold) based on your audio’s dynamics. Built for producers and mixing engineers.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: title,
    template: "%s | Compression Analyzer",
  },
  description,
  keywords: [
    "compression settings",
    "compressor attack and release",
    "vocal compression",
    "mixing tools",
    "audio compressor",
    "mixing engineer",
    "dynamics processing",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title,
    description,
    type: "website",
    locale: "en_US",
    siteName: "Compression Analyzer",
    url: siteUrl,
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-surface-900 text-white antialiased">
        <WebApplicationJsonLd />
        <Providers>{children}</Providers>
        <Analytics />
      </body>
    </html>
  );
}