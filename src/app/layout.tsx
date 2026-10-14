import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SmoothScroll } from "@/components/ui/smooth-scroll";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const appUrl = (
  process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://www.iplanetpay.com.br"
).replace(/\/$/, "");

const description =
  "Compre seu iPhone no seu ritmo. Reserva com aportes via Pix nas lojas iPlanet.";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "iPlanet Pay",
    template: "%s · iPlanet Pay",
  },
  description,
  applicationName: "iPlanet Pay",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "iPlanet Pay",
  },
  icons: {
    icon: [
      { url: "/icons/icon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: appUrl,
    siteName: "iPlanet Pay",
    title: "iPlanet Pay",
    description,
    images: [
      {
        url: "/og-iplanet-pay.png",
        width: 1200,
        height: 1200,
        alt: "iPlanet Pay",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "iPlanet Pay",
    description,
    images: ["/og-iplanet-pay.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#111111",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-[var(--bg)] antialiased`}
      >
        <SmoothScroll />
        {children}
      </body>
    </html>
  );
}
