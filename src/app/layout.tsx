import './globals.css';
import type { Metadata } from 'next';

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
      <body className="min-h-screen bg-gray-50">{children}</body>
    </html>
  )
}
