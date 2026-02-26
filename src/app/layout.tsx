import type { Metadata } from "next";
import { Inter, Syne } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { ScrollToTop } from "@/components/ScrollToTop";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const syne = Syne({ subsets: ["latin"], weight: ["400", "700", "800"], variable: "--font-syne" });

export const metadata: Metadata = {
  metadataBase: new URL("https://postovinky.news"),
  title: {
    default: "POSTOVINKY - Najnovšie správy a trendy",
    template: "%s | POSTOVINKY"
  },
  description: "Váš prémiový digitálny magazín o novinkách, technológiách a svetových trendoch. Denný prehľad zo sveta AI, tech, biznisu a svetových udalostí.",
  keywords: ["správy", "novinky", "technológie", "AI", "umelá inteligencia", "Slovensko", "magazín", "trendy"],
  authors: [{ name: "Postovinky", url: "https://postovinky.news" }],
  creator: "Postovinky",
  publisher: "Postovinky",
  formatDetection: { email: false, address: false, telephone: false },
  alternates: {
    canonical: "/",
    languages: { "sk-SK": "https://postovinky.news" },
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  icons: {
    icon: "/logo/black.png",
    apple: "/logo/black.png",
  },
  openGraph: {
    title: "POSTOVINKY - Digitálny magazín",
    description: "Váš denný prehľad toho najdôležitejšieho zo sveta technológií, biznisu a svetových udalostí.",
    url: "https://postovinky.news",
    siteName: "Postovinky",
    images: [
      {
        url: "/logo/black.png",
        width: 512,
        height: 512,
        alt: "Postovinky – logo",
      },
    ],
    locale: "sk_SK",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "POSTOVINKY - Digitálny magazín",
    description: "Váš denný prehľad zo sveta technológií, biznisu a svetových udalostí.",
    images: ["/logo/black.png"],
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
    <html lang="sk" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://postovinky.news" />
        <link rel="dns-prefetch" href="https://postovinky.news" />
      </head>
      <body className={`${inter.variable} ${syne.variable} font-sans min-h-screen flex flex-col`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          themes={["light", "dark", "colorful"]}
          enableSystem
          disableTransitionOnChange
        >
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "Organization",
                "@id": "https://postovinky.news/#organization",
                "name": "Postovinky",
                "url": "https://postovinky.news",
                "logo": {
                  "@type": "ImageObject",
                  "url": "https://postovinky.news/logo/black.png",
                  "width": 512,
                  "height": 512
                },
                "description": "Váš prémiový digitálny magazín o novinkách a trendoch.",
                "address": { "@type": "PostalAddress", "addressCountry": "SK" },
                "foundingDate": "2026"
              })
            }}
          />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "WebSite",
                "name": "Postovinky",
                "url": "https://postovinky.news",
                "description": "Váš prémiový digitálny magazín o novinkách, technológiách a svetových trendoch.",
                "inLanguage": "sk-SK",
                "publisher": { "@id": "https://postovinky.news/#organization" },
                "potentialAction": {
                  "@type": "SearchAction",
                  "target": { "@type": "EntryPoint", "urlTemplate": "https://postovinky.news/search?q={search_term_string}" },
                  "query-input": "required name=search_term_string"
                }
              })
            }}
          />
          <ScrollToTop />
          <Navbar />
          <main className="flex-grow flex flex-col">{children}</main>
          <Footer />
        </ThemeProvider>
      </body>
    </html>
  );
}
