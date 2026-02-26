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
  title: "POSTOVINKY - Najnovšie správy a trendy",
  description: "Váš prémiový digitálny magazín o novinkách, technológiách a svetových trendoch.",
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
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Postovinky News Portal",
      },
    ],
    locale: "sk_SK",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="sk" suppressHydrationWarning>
      <body className={`${inter.variable} ${syne.variable} font-sans min-h-screen flex flex-col`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          themes={["light", "dark", "colorful"]}
          enableSystem
          disableTransitionOnChange
        >
          <ScrollToTop />
          <Navbar />
          <main className="flex-grow flex flex-col">{children}</main>
          <Footer />
        </ThemeProvider>
      </body>
    </html>
  );
}
