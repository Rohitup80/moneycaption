import type { Metadata } from "next";
import { Outfit, Geist_Mono } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  display: "swap",
  weight: ["300", "400", "500", "600", "700", "800"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "MoneyCaption — Know Your Worth as a Creator",
    template: "%s | MoneyCaption",
  },
  description:
    "Calculate fair brand-deal pricing for Instagram, YouTube & Facebook. Get a professional rate card in 60 seconds — free for Indian content creators.",
  keywords: [
    "creator rate card",
    "influencer pricing",
    "brand deal calculator",
    "instagram rates india",
    "youtube sponsorship pricing",
    "content creator pricing tool",
  ],
  openGraph: {
    title: "MoneyCaption — Know Your Worth as a Creator",
    description:
      "Calculate fair brand-deal pricing across Instagram, YouTube & Facebook. Free rate card generator for Indian creators.",
    url: "https://moneycaption.com",
    siteName: "MoneyCaption",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "MoneyCaption — Know Your Worth",
    description:
      "Free rate card calculator for Indian content creators. Instagram, YouTube & Facebook.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${outfit.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
