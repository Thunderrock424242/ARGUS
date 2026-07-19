import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
import { AppShell } from "@/components/shell/app-shell";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host?.includes("localhost") || host?.startsWith("127.") ? "http" : "https");
  const origin = host ? `${protocol}://${host}` : "https://argus.local";
  const socialImage = new URL("/og.png", origin).toString();

  return {
    metadataBase: new URL(origin),
    title: {
      default: "ARGUS — Global Situational Awareness",
      template: "%s | ARGUS",
    },
    description:
      "ARGUS is a personal open-source intelligence and situational-awareness platform for observing, correlating, and understanding public information.",
    applicationName: "ARGUS",
    keywords: ["OSINT", "situational awareness", "intelligence analysis", "event monitoring"],
    openGraph: {
      title: "ARGUS — Observe. Correlate. Understand.",
      description: "Analysis and Reporting of Global Unfolding Situations",
      type: "website",
      images: [{ url: socialImage, width: 1731, height: 909, alt: "ARGUS global situational-awareness platform" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "ARGUS — Observe. Correlate. Understand.",
      description: "Analysis and Reporting of Global Unfolding Situations",
      images: [socialImage],
    },
    icons: {
      icon: "/argus-icon.png",
      shortcut: "/argus-icon.png",
      apple: "/argus-icon.png",
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body><AppShell>{children}</AppShell></body>
    </html>
  );
}
