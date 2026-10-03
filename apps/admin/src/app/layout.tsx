import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: { default: "Nidaa — Back-office", template: "%s · Nidaa" },
  description: "Back-office de la plateforme Nidaa : horaires de prière, annonces et écrans de votre mosquée.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-full">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
