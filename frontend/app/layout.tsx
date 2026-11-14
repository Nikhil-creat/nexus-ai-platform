import type { Metadata, Viewport } from "next";
import "./globals.css";
import ThemeLoader from "@/components/ThemeLoader";

export const metadata: Metadata = {
  title: "NEXUS — Autonomous admin panels, built by agents",
  description:
    "Refine-Nexus AI: ingest any API or database and get a secure, enterprise admin panel with agentic AI, hybrid RAG and CNN vision.",
  manifest: "/manifest.webmanifest",
};
export const viewport: Viewport = { themeColor: "#000000", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://d8j0ntlcm91z4.cloudfront.net" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Sora:wght@200;300;400&family=JetBrains+Mono:wght@300;400;500&display=swap"
        />
      </head>
      <body>
        <ThemeLoader />
        {children}
      </body>
    </html>
  );
}
