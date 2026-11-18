import type { Metadata, Viewport } from "next";
import type { CSSProperties } from "react";

import config from "@config";

import "./globals.css";

export const metadata: Metadata = {
  title: `${config.pageTitle} · ${config.businessName}`,
  description: `Book a meeting with ${config.businessName}.`,
  icons: { icon: "/favicon.svg" },
};

export const viewport: Viewport = {
  themeColor: "#f6f7f8",
};

const accent = {
  "--color-accent": config.accentColor,
  "--color-accent-ink": config.accentTextColor,
} as CSSProperties;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" style={accent}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
