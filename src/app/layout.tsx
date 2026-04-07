import type { Metadata } from "next";
import { Inter, Syne } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { ScrollToTop } from "@/components/ScrollToTop";
import { AnalyticsTracker } from "@/components/AnalyticsTracker";
import { UserProvider } from "@/contexts/UserContext";
import { ChatbotWidget } from "@/components/ChatbotWidget";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const syne = Syne({ subsets: ["latin"], weight: ["400", "700", "800"], variable: "--font-syne" });

export const metadata: Metadata = {
  metadataBase: new URL("https://aiwai.news"),
  title: {
    default: "AIWai – AI Správy, Technológie & Návody | Slovensko",
    template: "%s | AIWai"
  },
  description: "Najnovšie správy o umelej inteligencii, technológiách, AI modeloch a digitálnych trendoch. Denný prehľad AI noviniek, návody a tipy pre Slovensko.",
  keywords: [
    "umelá inteligencia", "AI správy", "AI novinky", "technologické správy",
    "technológie novinky", "ChatGPT", "Claude", "Gemini", "GPT-4",
    "AI modely", "AI výskum", "startupy", "AIWai", "správy Slovensko",
    "návody technológie", "AI návody", "tipy a triky", "digitálne novinky",
    "artificial intelligence news", "tech news Slovakia", "AI trends",
    "machine learning", "deep learning", "robotika", "automácia",
  ],
  authors: [{ name: "Redakcia AIWai", url: "https://aiwai.news" }],
  creator: "AIWai",
  publisher: "AIWai",
  formatDetection: { email: false, address: false, telephone: false },
  alternates: {
    canonical: "https://aiwai.news",
    languages: { "sk-SK": "https://aiwai.news" },
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/aiwai-logo.png", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
    shortcut: "/favicon.ico",
  },
  openGraph: {
    title: "AIWai – AI Správy, Technológie & Návody",
    description: "Najnovšie správy o umelej inteligencii, technológiách a digitálnych trendoch. Denný prehľad AI noviniek pre Slovensko.",
    url: "https://aiwai.news",
    siteName: "AIWai",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "AIWai – AI správy a technológie",
      },
    ],
    locale: "sk_SK",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AIWai – AI Správy & Technológie",
    description: "Najnovšie správy o umelej inteligencii, technológiách a digitálnych trendoch.",
    images: ["/og-image.png"],
  },
  ...(process.env.GOOGLE_SITE_VERIFICATION && {
    verification: {
      google: process.env.GOOGLE_SITE_VERIFICATION,
    },
  }),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="sk" suppressHydrationWarning className="dark">
      <head>
        <link rel="preconnect" href="https://aiwai.news" />
        <link rel="dns-prefetch" href="https://aiwai.news" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                let theme = localStorage.getItem('theme');
                let supportDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
                if (!theme && supportDarkMode) theme = 'dark';
                if (!theme) theme = 'dark';
                document.documentElement.className = theme;
                document.documentElement.style.backgroundColor = '#0a0a0a';
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body className={`${inter.variable} ${syne.variable} font-sans min-h-screen flex flex-col bg-background text-foreground transition-colors duration-300`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          themes={["light", "dark", "colorful"]}
          enableSystem
          disableTransitionOnChange
        >
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "NewsMediaOrganization",
                "@id": "https://aiwai.news/#organization",
                "name": "AIWai",
                "alternateName": "AIWai News",
                "url": "https://aiwai.news",
                "logo": {
                  "@type": "ImageObject",
                  "url": "https://aiwai.news/logo/black.png",
                  "width": 512,
                  "height": 512
                },
                "description": "Slovenský online magazín o umelej inteligencii, technológiách a digitálnych trendoch. Denné správy, návody a analýzy.",
                "address": { "@type": "PostalAddress", "addressCountry": "SK" },
                "foundingDate": "2026",
                "inLanguage": "sk-SK",
                "sameAs": [
                  "https://instagram.com/aiwai.news",
                  "https://x.com/aiwainews"
                ]
              })
            }}
          />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "WebSite",
                "@id": "https://aiwai.news/#website",
                "name": "AIWai – AI Správy & Technológie",
                "url": "https://aiwai.news",
                "description": "Najnovšie správy o umelej inteligencii, technológiách, návody a tipy pre Slovensko.",
                "inLanguage": "sk-SK",
                "publisher": { "@id": "https://aiwai.news/#organization" },
                "potentialAction": {
                  "@type": "SearchAction",
                  "target": { "@type": "EntryPoint", "urlTemplate": "https://aiwai.news/search?q={search_term_string}" },
                  "query-input": "required name=search_term_string"
                }
              })
            }}
          />
          <UserProvider>
            <AnalyticsTracker />
            <ScrollToTop />
            <Navbar />
            <main className="flex-grow flex flex-col">{children}</main>
            <Footer />
            <ChatbotWidget />
          </UserProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
