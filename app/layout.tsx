import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono, Playfair_Display } from "next/font/google";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import PageTransition from "../components/PageTransition";

// Design system fonts: Playfair Display (serif headlines), IBM Plex Sans (body
// & UI), IBM Plex Mono (bill numbers, data, section labels).
const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ibm-plex-sans",
  display: "swap",
});
const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-ibm-plex-mono",
  display: "swap",
});
const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["700", "800", "900"],
  variable: "--font-playfair",
  display: "swap",
});

export const metadata: Metadata = {
  // Resolves relative OG/Twitter image paths (e.g. "/og-image.png") to absolute
  // URLs, which social scrapers (Instagram, WhatsApp, iMessage, etc.) require.
  metadataBase: new URL("https://ncpolisearch.vercel.app"),
  title: "NCPoliSearch — NC Legislation Made Simple",
  description:
    "Plain-language summaries of every bill in the NC General Assembly. Nonpartisan, free, and built by NC Youth Legislative Council.",
  openGraph: {
    title: "NCPoliSearch — NC Legislation Made Simple",
    description:
      "Plain-language summaries of every bill in the NC General Assembly. Nonpartisan, free, and built by NC Youth Legislative Council.",
    images: ["/og-image.png"],
    url: "https://ncpolisearch.vercel.app",
    siteName: "NCPoliSearch",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "NCPoliSearch — NC Legislation Made Simple",
    description:
      "Plain-language summaries of every bill in the NC General Assembly. Nonpartisan, free, and built by NC Youth Legislative Council.",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${ibmPlexSans.variable} ${ibmPlexMono.variable} ${playfair.variable} antialiased flex min-h-screen flex-col bg-pagebg`}
      >
        <Navbar />
        <PageTransition>{children}</PageTransition>
        <Footer />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
