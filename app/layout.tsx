import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";

import ConsentBanner from "@/components/aegis/legal/ConsentBanner";
import { BRAND } from "@/lib/brand";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: {
    default: `${BRAND.appName}™`,
    template: `%s · ${BRAND.name} Wealth OS™`,
  },
  description: `${BRAND.tagline}. Strategic Intelligence. Generational Wealth.`,
};

export const viewport: Viewport = {
  themeColor: "#071B2A",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`h-full ${inter.variable}`}>
      <body
        className={`${inter.className} min-h-full bg-[#071B2A] text-[#F3F1EA] antialiased`}
      >
        {children}
        <ConsentBanner />
      </body>
    </html>
  );
}
