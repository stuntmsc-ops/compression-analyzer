import { getSiteUrl } from "@/lib/siteUrl";

const DESCRIPTION =
  "Upload your audio and get personalized compressor settings based on your track’s dynamics, for producers and mixing engineers.";

export default function WebApplicationJsonLd() {
  const url = getSiteUrl();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Compression Analyzer",
    description: DESCRIPTION,
    url,
    applicationCategory: "MultimediaApplication",
    operatingSystem: "Web browser",
    browserRequirements: "Requires JavaScript. HTML5 audio.",
    offers: {
      "@type": "Offer",
      name: "Compression Analyzer Pro",
      price: "9",
      priceCurrency: "USD",
      description: "Monthly subscription with unlimited analyses and all instruments.",
    },
    featureList: [
      "Personalized compression settings from uploaded audio",
      "Instrument, genre, and mix-goal targeting",
      "Technique coaching and plugin workflow tips (Pro)",
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
