import type { Metadata } from "next";
import { IBM_Plex_Mono, Newsreader } from "next/font/google";
import { AUTHOR, SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, SITE_URL } from "@/lib/site";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import "./globals.css";

const serif = Newsreader({
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
  style: ["normal", "italic"],
});
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_TITLE, template: `%s | ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "Sunburn",
    "solar flare",
    "shortwave fadeout",
    "radio blackout",
    "sudden ionospheric disturbance",
    "WSPR",
    "ham radio",
    "solar cycle 25",
    "GOES X-ray flux",
    "event study",
    "Omer Faizan",
  ],
  authors: [{ name: AUTHOR.name, url: AUTHOR.url }],
  creator: AUTHOR.name,
  alternates: { canonical: "/" },
  openGraph: {
    type: "article",
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: "/",
    locale: "en_US",
  },
  twitter: { card: "summary_large_image", title: SITE_TITLE, description: SITE_DESCRIPTION },
  robots: { index: true, follow: true },
};

const person = {
  "@type": "Person",
  name: AUTHOR.name,
  url: AUTHOR.url,
  ...(AUTHOR.email ? { email: `mailto:${AUTHOR.email}` } : {}),
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      name: SITE_NAME,
      alternateName: SITE_TITLE,
      url: `${SITE_URL}/`,
      description: SITE_DESCRIPTION,
      author: person,
      inLanguage: "en",
    },
    {
      "@type": "Dataset",
      name: "Solar flare shortwave fade-outs in WSPR reception, solar cycle 25",
      description:
        "Per-flare reception drops for M and X class flares (NOAA NCEI GOES-R XRS flare summary) measured in WSPR spot counts on sunlit versus dark paths, with a dose-response fit, band breakdown, placebo control and a held-out blind detector score.",
      url: `${SITE_URL}/`,
      creator: person,
      isAccessibleForFree: true,
      temporalCoverage: "2020-01-10/2026-11-13",
      keywords: ["solar flare", "shortwave fadeout", "WSPR", "ionosphere"],
    },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${serif.variable} ${mono.variable}`}>
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <div className="page">
          <SiteHeader />
          {children}
          <SiteFooter />
        </div>
      </body>
    </html>
  );
}
