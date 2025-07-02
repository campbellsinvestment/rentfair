import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Script from 'next/script';
import ToasterProvider from './components/ToasterProvider';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Rent Fair Ontario - Rent Comparison Tool | Compare Your Rent to Market Averages',
  description: 'Use Rent Fair Ontario to compare your Ontario apartment rent with official Statistics Canada market rates. See if your rent is above or below average in cities like Toronto, Ottawa, Hamilton, London and more.',
  keywords: 'rent comparison, Ontario rent, fair rent, apartment prices, rental market, CMHC data, Toronto rent, Ottawa rent, housing costs, Statistics Canada rental data',
  authors: [{ name: 'Rent Fair Ontario' }],
  creator: 'Rent Fair Ontario',
  publisher: 'Rent Fair Ontario',
  applicationName: 'Rent Fair Ontario',
  alternates: {
    canonical: 'https://rentfairontario.vercel.app',
  },
  category: 'Housing',
  openGraph: {
    title: 'Rent Fair Ontario - Compare Your Ontario Apartment Rent to Market Averages',
    description: 'Discover if you\'re paying too much for rent in Ontario with official Statistics Canada market data. Compare your apartment rent to city averages across Toronto, Ottawa and all Ontario cities.',
    url: 'https://rentfairontario.vercel.app',
    siteName: 'Rent Fair Ontario',
    locale: 'en_CA',
    type: 'website',
    images: [{
      url: '/og-image.jpg',
      width: 1200,
      height: 630,
      alt: 'Rent Fair Ontario - Ontario Rent Comparison Tool'
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Rent Fair Ontario - Compare Your Ontario Rent to Market Averages',
    description: 'Check if your Ontario rent is above or below market average with official Statistics Canada data.',
    images: ['/og-image.jpg'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    google: 'google-site-verification-code', // Add actual code when available
  },
  metadataBase: new URL('https://rentfairontario.vercel.app'), // Updated to match current domain
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" type="image/svg+xml" href="/logo/rentfair-favicon.svg" />
        <Script defer data-domain="rentfairontario.vercel.app" src="https://plausible.io/js/script.js" />
        <Script id="schema-org-data" type="application/ld+json">
          {`
            {
              "@context": "https://schema.org",
              "@type": "WebApplication",
              "name": "Rent Fair Ontario",
              "url": "https://rentfairontario.vercel.app",
              "description": "A tool to compare your Ontario apartment rent with official Statistics Canada market rates",
              "applicationCategory": "UtilityApplication",
              "operatingSystem": "All",
              "offers": {
                "@type": "Offer",
                "price": "0",
                "priceCurrency": "CAD"
              },
              "audience": {
                "@type": "Audience",
                "name": "Ontario Renters",
                "audienceType": "Renters, Apartment Tenants, Housing Market Researchers"
              },
              "provider": {
                "@type": "Organization",
                "name": "Rent Fair Ontario",
                "description": "Provider of rent comparison tools using official government data"
              },
              "about": {
                "@type": "Thing",
                "name": "Rental Market Data",
                "description": "Ontario apartment rental market rates from Statistics Canada"
              }
            }
          `}
        </Script>
        <Script id="local-business-data" type="application/ld+json">
          {`
            {
              "@context": "https://schema.org",
              "@type": "Dataset",
              "name": "Ontario Rental Market Data",
              "description": "Rental market data for Ontario cities sourced from Statistics Canada and CMHC",
              "keywords": ["Ontario", "rent", "apartment", "housing", "CMHC", "Statistics Canada", "rental market"],
              "creator": {
                "@type": "Organization",
                "name": "Statistics Canada"
              },
              "distribution": {
                "@type": "DataDownload",
                "contentUrl": "https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=3410013301"
              },
              "temporalCoverage": "2023-2025",
              "spatialCoverage": {
                "@type": "Place",
                "name": "Ontario, Canada"
              }
            }
          `}
        </Script>
      </head>
      <body className={inter.className}>
        <ToasterProvider />
        
        <main className="main-content">
          <div className="container">
            {children}
          </div>
        </main>
        
        <footer>
          <div className="container">
            <div className="footer-content">
              <p className="footer-text">
                This tool uses official rental market data from <strong>Statistics Canada</strong>, sourced from the Canada Mortgage and Housing Corporation (CMHC) Rental Market Survey. Rent Fair Ontario does not collect or store any personal user data on this platform.
              </p>
              <div className="footer-verification">
                <a href="https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=3410013301" target="_blank" rel="noopener noreferrer" className="footer-verify-link">
                  Verify Data Source
                </a>
              </div>
            </div>
            <div className="copyright">
              © {new Date().getFullYear()} Rent Fair Ontario. All rights reserved.
            </div>
          </div>
        </footer>
      </body>
    </html>
  )
}
