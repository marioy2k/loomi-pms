import type { Metadata } from "next";
import "./globals.css";
import {LanguageProvider} from "./language";

export const metadata: Metadata = {
  title: "Loomi PMS",
  description: "Loomi: Turn on the brilliant way to manage stays.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased"><LanguageProvider>{children}</LanguageProvider></body>
    </html>
  );
}
