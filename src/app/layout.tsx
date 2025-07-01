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
        <header>
          <div className="container header-container">
            <a href="/" className="logo">RentFair</a>
            <nav className="main-nav">
              <ul>
                <li><a href="/">Home</a></li>
                <li><a href="#about">About</a></li>
                <li><a href="#data-info">Data Info</a></li>
              </ul>
            </nav>
          </div>
        </header>
        
        <main className="main-content">
          <div className="container">
            {children}
          </div>
        </main>
        
        <footer>
          <div className="container">
            <div className="footer-content">
              <div className="footer-column">
                <h3>RentFair</h3>
                <ul>
                  <li><a href="/">Home</a></li>
                  <li><a href="#about">About</a></li>
                  <li><a href="#data-info">Data Info</a></li>
                </ul>
              </div>
              <div className="footer-column">
                <h3>Resources</h3>
                <ul>
                  <li><a href="https://www.cmhc-schl.gc.ca/" target="_blank" rel="noopener noreferrer">CMHC Data</a></li>
                  <li><a href="https://www.ontario.ca/page/renting-ontario-your-rights" target="_blank" rel="noopener noreferrer">Ontario Tenant Rights</a></li>
                  <li><a href="https://tribunalsontario.ca/ltb/" target="_blank" rel="noopener noreferrer">Landlord and Tenant Board</a></li>
                </ul>
              </div>
              <div className="footer-column">
                <h3>Connect</h3>
                <ul>
                  <li><a href="mailto:info@rentfair.ca">Contact Us</a></li>
                  <li><a href="/privacy">Privacy Policy</a></li>
                  <li><a href="/terms">Terms of Use</a></li>
                </ul>
              </div>
            </div>
            <div className="copyright">
              © {new Date().getFullYear()} RentFair. All rights reserved. Data sourced from CMHC.
            </div>
          </div>
        </footer>
      </body>
    </html>
  )
}
