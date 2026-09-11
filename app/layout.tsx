import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { DM_Sans, DM_Serif_Display } from 'next/font/google'
import './globals.css'

const sans = DM_Sans({ subsets: ['latin'], variable: '--font-sans' })
const serif = DM_Serif_Display({ subsets: ['latin'], weight: '400', variable: '--font-serif' })

export const metadata: Metadata = {
  title: 'brand.code — Beautiful QR & barcodes for Bangladesh',
  description: 'Create memorable, on-brand QR codes and barcodes for your business in seconds.',
  generator: 'v0.app',
}

export const viewport: Viewport = { colorScheme: 'light', themeColor: '#f8f9f5' }

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" className={`${sans.variable} ${serif.variable}`}><body className="antialiased">{children}{process.env.NODE_ENV === 'production' && <Analytics />}</body></html>
}
