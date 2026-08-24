import type { Metadata } from 'next'
import Link from 'next/link'

import { Nav } from './nav'
import './globals.css'

export const metadata: Metadata = {
  title: 'Harbor PMS · Reservations',
  description: 'A minimal property reservation manager.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang='en'>
      <body>
        <div className='flex min-h-screen flex-col'>
          <header className='site-header sticky top-0 z-10 border-b border-[var(--line)] bg-[var(--header-bg)] backdrop-blur'>
            <div className='page-wrap flex items-center justify-between py-4'>
              <Link href='/' className='flex items-center gap-2 no-underline'>
                <span className='grid size-9 place-items-center rounded-xl bg-[var(--lagoon-deep)] text-lg font-bold text-white shadow-sm'>
                  ⚓
                </span>
                <span className='display-title text-xl font-bold text-[var(--sea-ink)]'>
                  Harbor PMS
                </span>
              </Link>
              <Nav />
            </div>
          </header>

          <main className='flex-1'>{children}</main>

          <footer className='site-footer mt-16'>
            <div className='page-wrap py-6 text-sm text-[var(--sea-ink-soft)]'>
              Harbor PMS — a minimal property reservation manager.
            </div>
          </footer>
        </div>
      </body>
    </html>
  )
}
