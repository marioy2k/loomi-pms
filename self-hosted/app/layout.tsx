import type { Metadata } from "next";
import "./globals.css";
import {ColorModeProvider} from "./color-mode";
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
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased"><LanguageProvider><ColorModeProvider>{children}</ColorModeProvider></LanguageProvider></body>
    </html>
  );
}
