import Script from 'next/script'

interface PageHeadProps {
  city?: string;
  averageRent?: number;
  dataAge?: string;
}

export default function PageHead({ city = 'Ontario', averageRent, dataAge }: PageHeadProps) {
  // Generate city-specific or general schema based on available data
  const generatePageSchema = () => {
    const baseSchema = {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "name": `Rent Fair Ontario - ${city} Rent Comparison`,
      "description": `Compare your ${city} apartment rent with official Statistics Canada market rates.`,
      "url": `https://rentfair.ca${city !== 'Ontario' ? `?city=${encodeURIComponent(city)}` : ''}`,
      "speakable": {
        "@type": "SpeakableSpecification",
        "cssSelector": [".hero-section h1", ".tagline", ".comparison-highlight"]
      },
      "mainEntity": {
        "@type": "SoftwareApplication",
        "name": "Rent Fair Ontario",
        "applicationCategory": "UtilityApplication",
        "operatingSystem": "Any"
      }
    };

    // Add pricing data if we have average rent information
    if (averageRent) {
      return {
        ...baseSchema,
        "mainEntity": {
          ...baseSchema.mainEntity,
          "@type": "Product",
          "name": `Average Rent in ${city}`,
          "description": `Average apartment rent in ${city}, Ontario based on Statistics Canada data`,
          "offers": {
            "@type": "Offer",
            "priceCurrency": "CAD",
            "price": averageRent,
            "priceValidUntil": dataAge || new Date(new Date().setMonth(new Date().getMonth() + 6)).toISOString().split('T')[0]
          }
        }
      };
    }

    return baseSchema;
  };

  const pageSchema = generatePageSchema();

  return (
    <>
      <Script id="rent-comparison-data" type="application/ld+json">
        {JSON.stringify(pageSchema)}
      </Script>
      <Script id="faq-schema" type="application/ld+json">
        {`
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            "mainEntity": [
              {
                "@type": "Question",
                "name": "How accurate is Rent Fair Ontario's rent comparison data?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "Rent Fair Ontario uses official data from Statistics Canada, sourced from the Canada Mortgage and Housing Corporation (CMHC) Rental Market Survey. For data older than 6 months, we apply an estimated 5% annual increase to better reflect current market conditions."
                }
              },
              {
                "@type": "Question",
                "name": "What cities does Rent Fair Ontario cover?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "Rent Fair Ontario covers major cities across Ontario including Toronto, Ottawa, Hamilton, London, Windsor, Kingston, Kitchener-Waterloo, Sudbury, Thunder Bay, and many others."
                }
              },
              {
                "@type": "Question",
                "name": "How do I know if my rent is fair?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "Rent Fair Ontario compares your rent to average market rates. If your rent is within 15% of average, it's considered a fair market rate. If it's more than 15% below average, you're getting a good deal. If it's more than 15% above average, you're paying premium pricing."
                }
              }
            ]
          }
        `}
      </Script>
      <Script id="breadcrumb-schema" type="application/ld+json">
        {`
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            "itemListElement": [
              {
                "@type": "ListItem",
                "position": 1,
                "name": "Rent Fair Ontario",
                "item": "https://rentfair.ca"
              },
              ${city !== 'Ontario' ? 
                `{
                  "@type": "ListItem",
                  "position": 2,
                  "name": "${city} Rent Comparison",
                  "item": "https://rentfair.ca?city=${encodeURIComponent(city)}"
                }` : ''}
            ]
          }
        `}
      </Script>
      <Script
        id="structured-data-script"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Organization",
            "url": "https://rentfair.ca",
            "logo": "https://rentfair.ca/logo.png",
            "name": "Rent Fair Ontario",
            "description": "Compare your Ontario apartment rent with official Statistics Canada market rates.",
            "sameAs": [
              // Add social media links when available
            ]
          })
        }}
      />
    </>
  );
}