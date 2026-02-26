# SEO – Postovinky

## Čo je v projekte nastavené

- **OG obrázok**: Používa sa logo `/logo/black.png` (Open Graph aj Twitter).
- **Google Search Console**: Verifikácia cez meta tag – pozri nižšie.
- **Structured Data**: Organization (s logo ImageObject), WebSite (s SearchAction), NewsArticle, BreadcrumbList. Publisher v článkoch odkazuje na `#organization`.
- **LCP**: Prvý obrázok na homepage má `priority`, aby sa skôr načítal (lepší Core Web Vitals).

---

## 1. Google Search Console

1. Choď na [Google Search Console](https://search.google.com/search-console) a pridaj majetok `https://postovinky.news`.
2. Pri **verifikácii metódou „Meta tag“** skopíruj hodnotu z poľa `content` (napr. `AbCdEf123...`).
3. Do **prostredia nasadenia** (Vercel / server) pridaj premennú:
   ```bash
   GOOGLE_SITE_VERIFICATION=AbCdEf123...
   ```
   (nahraď skutočným kódom z Search Console.)
4. Po nasadení znova spusti verifikáciu v Search Console.
5. V Search Console pridaj **Sitemap**:  
   `https://postovinky.news/sitemap.xml`

---

## 2. Testovanie štruktúrovaných údajov

- [Google Rich Results Test](https://search.google.com/test/rich-results) – zadaj URL článku alebo homepage a skontroluj Organization, WebSite, NewsArticle, BreadcrumbList.
- [Schema.org Validator](https://validator.schema.org/) – pre kontrolu JSON-LD.

---

## 3. Výkon a Core Web Vitals

Po nasadení skontroluj:

- [PageSpeed Insights](https://pagespeed.web.dev/) – zadaj `https://postovinky.news`
- V Search Console: **Skúsenosti** → Core Web Vitals

Na homepage je pre prvý (hlavný) obrázok nastavené `priority`, čo pomáha LCP.
