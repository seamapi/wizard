import Link from 'next/link'

import { listGuests } from '@/lib/queries'

export const dynamic = 'force-dynamic'

export default async function GuestsPage() {
  const guests = await listGuests()

  return (
    <div className='page-wrap py-12'>
      <div className='rise-in flex flex-wrap items-end justify-between gap-4'>
        <div>
          <p className='island-kicker'>Directory</p>
          <h1 className='display-title mt-2 text-4xl font-bold text-[var(--sea-ink)]'>
            Guests
          </h1>
          <p className='mt-2 text-[var(--sea-ink-soft)]'>
            {guests.length} unique guest{guests.length === 1 ? '' : 's'}
          </p>
        </div>
        <Link
          href='/reservations'
          className='rounded-xl border border-[var(--line)] bg-white/70 px-5 py-2.5 font-semibold text-[var(--sea-ink)] no-underline hover:bg-white'
        >
          View reservations
        </Link>
      </div>

      {guests.length === 0 ? (
        <div className='island-shell rise-in mt-8 rounded-2xl p-12 text-center text-[var(--sea-ink-soft)]'>
          No guests yet. They&apos;ll appear here after the first booking.
        </div>
      ) : (
        <div className='island-shell rise-in mt-8 overflow-hidden rounded-2xl'>
          <table className='w-full text-left text-sm'>
            <thead>
              <tr className='border-b border-[var(--line)] text-[var(--sea-ink-soft)]'>
                <th className='px-5 py-3 font-semibold'>Name</th>
                <th className='px-5 py-3 font-semibold'>Email</th>
                <th className='px-5 py-3 font-semibold'>Phone</th>
                <th className='px-5 py-3 text-right font-semibold'>Stays</th>
              </tr>
            </thead>
            <tbody>
              {guests.map((guest) => (
                <tr
                  key={guest.email}
                  className='border-b border-[var(--line)] last:border-0'
                >
                  <td className='px-5 py-3 font-semibold text-[var(--sea-ink)]'>
                    {guest.name}
                  </td>
                  <td className='px-5 py-3'>
                    <a href={`mailto:${guest.email}`}>{guest.email}</a>
                  </td>
                  <td className='px-5 py-3'>
                    <a href={`tel:${guest.phone}`}>{guest.phone}</a>
                  </td>
                  <td className='px-5 py-3 text-right font-semibold text-[var(--sea-ink)]'>
                    {guest.reservationCount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
