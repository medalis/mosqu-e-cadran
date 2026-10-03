import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SITE_URL } from "@/lib/api";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "Nidaa — Les horaires réels de votre mosquée", template: "%s · Nidaa" },
  description: "Nidaa diffuse les horaires de prière réels (adhan et iqama) de chaque mosquée : page publique, écran de salle et widget.",
  openGraph: { siteName: "Nidaa", locale: "fr_FR", type: "website" },
};
export const viewport: Viewport = { themeColor: "#070b16", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Outfit:wght@300;400;500;600&display=swap" />
      </head>
      <body>{children}</body>
    </html>
  );
}
