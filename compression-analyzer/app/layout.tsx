import type { Metadata } from "next";
import "./globals.css";

// Vercel automatically sets VERCEL_URL (e.g. my-app-abc123.vercel.app) on deployed
// builds. On local dev we fall back to localhost:3000. Replace this with your real
// custom domain once you've set one up.
const siteUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Compression Analyzer — Personalized Compression Settings From Your Audio",
  description:
    "Upload your audio and get compression settings based on your actual sound. Built for producers and mixing engineers who want to stop guessing.",
  keywords: [
    "compression settings",
    "vocal compression",
    "mixing tools",
    "audio compressor",
    "mixing engineer tools",
  ],
  openGraph: {
    title: "Compression Analyzer",
    description: "Personalized compression settings based on your actual audio.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Compression Analyzer",
    description: "Personalized compression settings based on your actual audio.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-surface-900 text-white antialiased">{children}</body>
    </html>
  );
}