import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";

export const metadata: Metadata = {
  title: "Prisma App",
  description:
    "Plataforma de gestão editorial para equipes de comunicação governamental. Gerencie pautas, captações e publicações em um calendário colaborativo.",
  keywords: ["prisma", "govtech", "prisma app", "calendário editorial"],
  icons: {
    icon: "/favicon-prisma.png",
    shortcut: "/favicon-prisma.png",
    apple: "/favicon-prisma.png",
    other: {
      rel: "apple-touch-icon-precomposed",
      url: "/favicon-prisma.png",
    },
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f8fafc",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body
        className="relative min-h-screen overflow-x-hidden bg-slate-50 font-sans text-slate-950 antialiased selection:bg-primary/20"
        style={{
          paddingTop: "env(safe-area-inset-top, 0px)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
