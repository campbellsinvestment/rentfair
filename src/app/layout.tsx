import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'RentFair - Ontario Rent Comparison',
  description: 'Compare your Ontario apartment rent to current market rates and see if you\'re getting a fair deal.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        
        <main className="main-content">
          <div className="container">
            {children}
          </div>
        </main>
        
        <footer>
          <div className="container">
            <div className="footer-content">
              <p className="footer-text">
                This tool uses official rental market data from <strong>Statistics Canada</strong>, sourced from the Canada Mortgage and Housing Corporation (CMHC) Rental Market Survey. RentFair does not collect or store any personal user data on this platform.
              </p>
              <div className="footer-verification">
                <a href="https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=3410013301" target="_blank" rel="noopener noreferrer" className="footer-verify-link">
                  Verify Data Source
                </a>
              </div>
            </div>
            <div className="copyright">
              © {new Date().getFullYear()} RentFair. All rights reserved.
            </div>
          </div>
        </footer>
      </body>
    </html>
  )
}
