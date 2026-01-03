import "./globals.css";
import { ReactNode } from "react";
import type { Metadata } from "next";
import { requireClientEnv } from "@/lib/env";

requireClientEnv();

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Local Estimates",
    template: "%s | Local Estimates",
  },
  description: "Request fast, professional estimates from vetted local teams.",
  openGraph: {
    type: "website",
    title: "Local Estimates",
    description: "Request fast, professional estimates from vetted local teams.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Local Estimates",
    description: "Request fast, professional estimates from vetted local teams.",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen text-slate-100">
          {children}
        </div>
      </body>
    </html>
  );
}
