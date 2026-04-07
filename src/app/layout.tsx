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
        url: "/og-image-v2.png",
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
    images: ["/og-image-v2.png"],
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
        {/* Anti-popup/overlay/redirect blocker — aggressive mobile + desktop protection */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function(){
                var ORIGIN = location.origin;
                var SAFE_HOSTS = ['aiwai.news', 'www.aiwai.news'];

                function isSafe(url) {
                  if (!url) return true;
                  try {
                    var u = new URL(url, location.href);
                    return SAFE_HOSTS.indexOf(u.hostname) !== -1 || u.origin === ORIGIN;
                  } catch(e) { return false; }
                }

                // 1. Block window.open popups from ad scripts
                var origOpen = window.open;
                window.open = function(url) {
                  if (isSafe(url)) return origOpen.apply(window, arguments);
                  console.warn('[AIWai] Blocked popup:', url);
                  return null;
                };

                // 2. Protect location from redirects by ad scripts
                var origLocation = location.href;
                var locationLocked = false;

                // Lock location after page loads — any redirect after that is suspicious
                window.addEventListener('load', function() {
                  origLocation = location.href;
                  locationLocked = true;
                });

                // Intercept location.assign and location.replace
                var origAssign = location.assign.bind(location);
                var origReplace = location.replace.bind(location);

                Object.defineProperty(window, 'locationAssign', { value: origAssign });
                Object.defineProperty(window, 'locationReplace', { value: origReplace });

                try {
                  location.assign = function(url) {
                    if (isSafe(url)) return origAssign(url);
                    console.warn('[AIWai] Blocked redirect (assign):', url);
                  };
                  location.replace = function(url) {
                    if (isSafe(url)) return origReplace(url);
                    console.warn('[AIWai] Blocked redirect (replace):', url);
                  };
                } catch(e) {}

                // 3. Block click hijacking — ad scripts add invisible overlays or document click listeners
                // that redirect on ANY tap (especially on mobile)
                document.addEventListener('click', function(e) {
                  var target = e.target;
                  if (!target || !target.closest) return;

                  // Allow clicks on real links and buttons within our app
                  var link = target.closest('a[href]');
                  if (link) {
                    var href = link.getAttribute('href') || '';
                    // Block external links injected by ad scripts (not in article content)
                    if (href.startsWith('http') && !isSafe(href)) {
                      var isInContent = link.closest('.prose, [data-aiwai], nav, footer, header');
                      if (!isInContent) {
                        e.preventDefault();
                        e.stopImmediatePropagation();
                        console.warn('[AIWai] Blocked hijacked link:', href);
                        return false;
                      }
                    }
                    return;
                  }

                  // Block clicks on invisible/transparent overlays (ad redirect trick)
                  if (target.tagName === 'DIV' || target.tagName === 'SPAN' || target.tagName === 'A') {
                    var style = window.getComputedStyle(target);
                    var opacity = parseFloat(style.opacity || '1');
                    var zIndex = parseInt(style.zIndex || '0', 10);
                    if ((opacity < 0.1 || style.pointerEvents === 'all') && zIndex > 999) {
                      e.preventDefault();
                      e.stopImmediatePropagation();
                      target.remove();
                      console.warn('[AIWai] Removed invisible click overlay');
                      return false;
                    }
                  }
                }, true);

                // 4. DOM observer — remove fullscreen overlays, suspicious iframes, and ad scripts
                var blockedScriptPatterns = [
                  'popunder', 'popnew', 'directlink', 'social-bar',
                  'profitablegatecpm', 'profitablecpmratenetwork',
                  'vfrfrrf', 'surfrfrfr', 'removeatag', 'syndication',
                  'clickunder', 'pushno', 'notifpush', 'pushnot'
                ];

                var observer = new MutationObserver(function(mutations) {
                  for (var i = 0; i < mutations.length; i++) {
                    var nodes = mutations[i].addedNodes;
                    for (var j = 0; j < nodes.length; j++) {
                      var el = nodes[j];
                      if (el.nodeType !== 1) continue;

                      // Remove fullscreen overlays
                      var s = el.style || {};
                      var cs = window.getComputedStyle ? window.getComputedStyle(el) : {};
                      var pos = s.position || cs.position || '';
                      var z = parseInt(s.zIndex || cs.zIndex || '0', 10);

                      if ((pos === 'fixed' || pos === 'absolute') && z > 999) {
                        var rect = el.getBoundingClientRect ? el.getBoundingClientRect() : {};
                        var isLarge = (rect.width > window.innerWidth * 0.5 && rect.height > window.innerHeight * 0.5);
                        var isOurs = el.closest && (el.closest('[data-aiwai]') || el.closest('nav') || el.closest('header'));
                        if (isLarge && !isOurs && !(el.id && el.id.startsWith('aiwai'))) {
                          console.warn('[AIWai] Removed overlay:', el.tagName, el.className);
                          el.remove();
                          continue;
                        }
                      }

                      // Remove suspicious iframes
                      if (el.tagName === 'IFRAME') {
                        var src = (el.src || '').toLowerCase();
                        if (z > 999 || (src && !src.includes('aiwai.news') && !src.includes('highperformanceformat'))) {
                          // Allow iframes inside our ad containers
                          var inAdContainer = el.closest && el.closest('[class*="AdBanner"], [class*="ad-"]');
                          if (!inAdContainer && z > 999) {
                            console.warn('[AIWai] Removed iframe:', src);
                            el.remove();
                            continue;
                          }
                        }
                      }

                      // Block known malicious scripts
                      if (el.tagName === 'SCRIPT' && el.src) {
                        var scriptSrc = el.src.toLowerCase();
                        for (var k = 0; k < blockedScriptPatterns.length; k++) {
                          if (scriptSrc.includes(blockedScriptPatterns[k])) {
                            console.warn('[AIWai] Blocked script:', el.src);
                            el.remove();
                            break;
                          }
                        }
                      }

                      // Remove injected <a> tags that cover the whole page (mobile redirect trick)
                      if (el.tagName === 'A') {
                        var aStyle = window.getComputedStyle ? window.getComputedStyle(el) : {};
                        var aPos = el.style.position || aStyle.position || '';
                        if ((aPos === 'fixed' || aPos === 'absolute') && parseInt(el.style.zIndex || aStyle.zIndex || '0', 10) > 99) {
                          var aRect = el.getBoundingClientRect ? el.getBoundingClientRect() : {};
                          if (aRect.width > window.innerWidth * 0.5 && aRect.height > window.innerHeight * 0.3) {
                            console.warn('[AIWai] Removed fullscreen link overlay:', el.href);
                            el.remove();
                            continue;
                          }
                        }
                      }
                    }
                  }
                });
                observer.observe(document.documentElement, { childList: true, subtree: true });

                // 5. Block meta refresh redirects
                var metaObserver = new MutationObserver(function(mutations) {
                  var metas = document.querySelectorAll('meta[http-equiv="refresh"]');
                  for (var i = 0; i < metas.length; i++) {
                    var content = metas[i].getAttribute('content') || '';
                    if (content.toLowerCase().includes('url=') && !isSafe(content.split('url=')[1])) {
                      console.warn('[AIWai] Blocked meta refresh redirect');
                      metas[i].remove();
                    }
                  }
                });
                metaObserver.observe(document.head || document.documentElement, { childList: true, subtree: true });

                // 6. Periodic cleanup — catch things the observer might miss
                setInterval(function() {
                  // Remove any fullscreen fixed elements that aren't ours
                  var all = document.querySelectorAll('[style*="position: fixed"], [style*="position:fixed"]');
                  for (var i = 0; i < all.length; i++) {
                    var el = all[i];
                    var z = parseInt(el.style.zIndex || '0', 10);
                    if (z > 9000) {
                      var isOurs = el.closest && (el.closest('[data-aiwai]') || el.closest('nav') || el.closest('header'));
                      if (!isOurs && !(el.id && el.id.startsWith('aiwai'))) {
                        el.remove();
                      }
                    }
                  }
                }, 2000);
              })();
            `,
          }}
        />
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
            <div data-aiwai="scroll-top"><ScrollToTop /></div>
            <Navbar />
            <main className="flex-grow flex flex-col">{children}</main>
            <Footer />
            <div data-aiwai="chatbot"><ChatbotWidget /></div>
          </UserProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
