'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_LINKS: Array<{ href: string; label: string; exact?: boolean }> = [
  { href: '/', label: 'Book a stay', exact: true },
  { href: '/reservations', label: 'Reservations' },
  { href: '/spaces', label: 'Spaces' },
  { href: '/guests', label: 'Guests' },
]

export function Nav() {
  const pathname = usePathname()

  return (
    <nav className='flex items-center gap-6 text-sm font-semibold'>
      {NAV_LINKS.map((link) => {
        const is_active = link.exact
          ? pathname === link.href
          : pathname.startsWith(link.href)
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`nav-link ${is_active ? 'is-active' : ''}`}
          >
            {link.label}
          </Link>
        )
      })}
    </nav>
  )
}
