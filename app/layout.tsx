import type { Metadata } from "next";
import { Geist, Geist_Mono, Anton, Playfair_Display } from "next/font/google";
import "./globals.css";

// Default Next.js fonts — used throughout the app for body/mono text.
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Anton: bold condensed display font used for the "debatable." title and nav logo.
// Aliased as --font-bebas so usage sites don't need to know which font is loaded.
const anton = Anton({
  variable: "--font-bebas",
  weight: "400",
  subsets: ["latin"],
});

// Playfair Display italic: used for the rotating questions on the landing page.
const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  style: ["italic"],
});

export const metadata: Metadata = {
  title: "debatable.",
  description: "Make your case. Let the record show.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${anton.variable} ${playfair.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
