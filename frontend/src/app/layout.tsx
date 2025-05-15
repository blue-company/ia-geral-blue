import { ThemeProvider } from "@/components/home/theme-provider";
import "./background.css";
import { siteConfig } from "@/lib/site";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { Toaster } from "@/components/ui/sonner";
import { Analytics } from "@vercel/analytics/react";
import { GoogleAnalytics } from "@next/third-parties/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import Script from "next/script";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#0a0814",
};

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: siteConfig.name,
    template: `%s - ${siteConfig.name}`,
  },
  description: "InventuAI é um assistente de IA que ajuda você a realizar tarefas do mundo real com facilidade. Através de conversas naturais, o InventuAI se torna seu companheiro digital para pesquisas, análise de dados e desafios cotidianos.",
  keywords: ["IA", "inteligência artificial", "automação de navegador", "web scraping", "gerenciamento de arquivos", "assistente de IA", "código aberto", "pesquisa", "análise de dados"],
  authors: [{ name: "InventuAI Team", url: "https://inventu.ai" }],
  creator: "InventuAI Team",
  publisher: "InventuAI Team",
  category: "Technology",
  applicationName: "InventuAI",
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
  openGraph: {
    title: "InventuAI - Thanus",
    description: "Thanus é um assistente de IA que ajuda você a realizar tarefas do mundo real com facilidade por meio de uma conversa natural.",
    url: siteConfig.url,
    siteName: "InventuAI",
    images: [{
      url: "/banner.png",
      width: 1200,
      height: 630,
      alt: "InventuAI - Thanus",
      type: "image/png",
    }],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "InventuAI - Thanus",
    description: "Thanus é um assistente de IA que ajuda você a realizar tarefas do mundo real com facilidade por meio de uma conversa natural.",
    creator: "@InventuAI",
    site: "@InventuAI",
    images: [{
      url: "/banner.png",
      width: 1200,
      height: 630,
      alt: "InventuAI - Thanus",
    }],
  },
  icons: {
    icon: [
      { url: "/favicon.png", sizes: "any" },
    ],
    shortcut: "/favicon.png",
  },
  // manifest: "/manifest.json",
  alternates: {
    canonical: siteConfig.url,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Google Tag Manager */}
        <Script id="google-tag-manager" strategy="afterInteractive">
          {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
          new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
          j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
          'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
          })(window,document,'script','dataLayer','GTM-PCHSN4M2');`}
        </Script>
        {/* End Google Tag Manager */}
      </head>

      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased font-sans bg-background`}
      >
                {/* Deep space background for all pages */}
                <div className="stars-background">
          {/* Base color - very dark purple/black */}
          <div className="bg-dark-space"></div>
          
          {/* Subtle purple glow in the center */}
          <div className="purple-glow"></div>
          
          {/* Animated stars */}
          <div className="stars-layer stars-layer-1"></div>
          <div className="stars-layer stars-layer-2"></div>
          <div className="stars-layer stars-layer-3"></div>
        </div>
        {/* Google Tag Manager (noscript) */}
        <noscript>
          <iframe 
            src="https://www.googletagmanager.com/ns.html?id=GTM-PCHSN4M2"
            height="0" 
            width="0" 
            style={{ display: 'none', visibility: 'hidden' }}
          />
        </noscript>
        {/* End Google Tag Manager (noscript) */}
        
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <Providers>
            {children}
            <Toaster />
          </Providers>
          <Analytics />
          <GoogleAnalytics gaId="G-6ETJFB3PT3" />
          <SpeedInsights />
        </ThemeProvider>
      </body>
    </html>
  );
}
