import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { siteUrl } from "@/lib/env";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: "Pizza Health — cuidar junto fica mais leve",
    template: "%s · Pizza Health",
  },
  description:
    "Rede social privada de saúde e bem-estar: hábitos, exames, vacinas e desafios com amigos, com privacidade por padrão.",
  applicationName: "Pizza Health",
  keywords: [
    "saúde",
    "hábitos",
    "exames",
    "vacinas",
    "comunidade",
    "bem-estar",
    "amigos",
  ],
  authors: [{ name: "Pizza Health" }],
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "Pizza Health",
    title: "Pizza Health — cuidar junto fica mais leve",
    description:
      "Uma comunidade privada para acompanhar hábitos, organizar exames e se cuidar com quem você confia.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Pizza Health — cuidar junto fica mais leve",
    description:
      "Hábitos, exames, vacinas e desafios com amigos. Privacidade por padrão.",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#fffaf4",
  colorScheme: "light",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="flex min-h-dvh flex-col antialiased">{children}</body>
    </html>
  );
}
