import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: {
    default: "AEGIS Wealth Operating System™",
    template: "%s · AEGIS Wealth OS™",
  },
  description:
    "Institutional-grade wealth architecture platform. Strategic Intelligence. Generational Wealth.",
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
      </body>
    </html>
  );
}
