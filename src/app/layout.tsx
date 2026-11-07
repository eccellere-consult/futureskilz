import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

/**
 * Fonts are served from this repository (SIL Open Font License, via Fontsource), not fetched from Google while building.
 * The host's build machine cannot always reach Google Fonts, and a failed font download stops the whole deploy.
 */
const displayFont = localFont({
  variable: "--font-cormorant",
  display: "swap",
  src: [
    { path: "./fonts/cormorant-garamond-latin-300-normal.woff2", weight: "300", style: "normal" },
    { path: "./fonts/cormorant-garamond-latin-300-italic.woff2", weight: "300", style: "italic" },
    { path: "./fonts/cormorant-garamond-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/cormorant-garamond-latin-400-italic.woff2", weight: "400", style: "italic" },
    { path: "./fonts/cormorant-garamond-latin-600-normal.woff2", weight: "600", style: "normal" },
    { path: "./fonts/cormorant-garamond-latin-600-italic.woff2", weight: "600", style: "italic" },
  ],
});

const bodyFont = localFont({
  variable: "--font-dm-sans",
  display: "swap",
  src: [
    { path: "./fonts/dm-sans-latin-300-normal.woff2", weight: "300", style: "normal" },
    { path: "./fonts/dm-sans-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "./fonts/dm-sans-latin-500-normal.woff2", weight: "500", style: "normal" },
  ],
});

const monoFont = localFont({
  variable: "--font-jetbrains-mono",
  display: "swap",
  src: [{ path: "./fonts/jetbrains-mono-latin-400-normal.woff2", weight: "400", style: "normal" }],
});

export const metadata: Metadata = {
  title: {
    default: "FutureSkilz",
    template: "%s | FutureSkilz",
  },
  description: "Learning reimagined. Skills for the AI age.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${displayFont.variable} ${bodyFont.variable} ${monoFont.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
