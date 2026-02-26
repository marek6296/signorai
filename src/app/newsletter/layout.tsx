import type { Metadata } from "next";

const BASE_URL = "https://postovinky.news";

export const metadata: Metadata = {
  title: "Newsletter AI Weekly",
  description: "Odoberajte AI Weekly – každú nedeľu kurátorský výber toho najdôležitejšieho zo sveta umelej inteligencie. Žiadny spam, odber zrušíte kedykoľvek.",
  alternates: { canonical: `${BASE_URL}/newsletter` },
  openGraph: {
    title: "Newsletter AI Weekly | Postovinky",
    description: "Získajte náskok pred ostatnými. Každú nedeľu zhrnutie týždňa do 5 minút čítania.",
    url: `${BASE_URL}/newsletter`,
    siteName: "Postovinky",
    locale: "sk_SK",
  },
  twitter: {
    card: "summary_large_image",
    title: "Newsletter AI Weekly | Postovinky",
    description: "Kurátorský výber zo sveta AI každú nedeľu. Prihláste sa.",
  },
};

export default function NewsletterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
