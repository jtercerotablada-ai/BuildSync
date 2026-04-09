import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "@/components/providers/session-provider";
import { QueryProvider } from "@/components/providers/query-provider";
import { AIPanelProvider } from "@/contexts/ai-panel-context";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "TT Civil & Structural | Project Management",
  description: "Tercero Tablada Civil & Structural Engineering - Project Management Platform",
  icons: {
    icon: "/ttc/img/logo-icon-favicon.svg",
    shortcut: "/ttc/img/logo-icon-favicon.svg",
    apple: "/ttc/img/logo-icon-favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <SessionProvider>
            <AIPanelProvider>
              <QueryProvider>
                {children}
                <Toaster />
              </QueryProvider>
            </AIPanelProvider>
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
