# Nuxt PMS

A tiny property-management app built with [Nuxt 3](https://nuxt.com/) (Vue),
`better-sqlite3` (raw SQL, no ORM), and zod. It manages **spaces** (bookable
rooms, suites, cabins…), takes **reservations** against them, and lists the
**guests** who have booked. It is the Nuxt/Vue counterpart of the Next.js
`nextjs-pms` sample, with the same domain so the two exercise the same
integration.

## Getting started

```bash
npm install
cp .env.example .env   # then fill in SEAM_API_KEY
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The SQLite database
(`dev.db`) is created and seeded with a few spaces automatically on first
request.

## Pages

- `/` — the public booking form. Pick dates and party size to see live
  availability, then request a stay.
- `/reservations` — the front desk: every reservation with its guest, status,
  dates, and assigned space. Confirm, cancel, reassign, or delete a stay. This
  is where a smart-lock integration would surface access for a reservation (a
  PIN, a mobile key).
- `/spaces` — inventory: add, edit, and archive/restore bookable spaces.
- `/guests` — the derived guest directory (deduped by email).

## Layout

- `nuxt.config.ts` — Nuxt config; registers the stylesheet and keeps
  `better-sqlite3` external to the server bundle.
- `pages/` — the four Vue pages (`index`, `reservations`, `spaces`, `guests`),
  with `layouts/default.vue` providing the header nav and footer.
- `components/SpaceForm.vue` — the add/edit form used on the spaces page.
- `shared/` — code shared by the server and the pages (imported via the
  `#shared` alias): `space-kinds.ts`, `schemas.ts` (zod), `types.ts`,
  `format.ts`, and `errors.ts`.
- `server/utils/` — auto-imported server logic: `db.ts` (the `better-sqlite3`
  connection + schema created on first use), `queries.ts` (reads),
  `availability.ts` (overlap/capacity checks), and `mutations.ts` (writes).
- `server/api/` — the route handlers: `book.post.ts`, the `reservations/`
  and `spaces/` collections, and `guests/`.

## Availability

Reservations hold a space for the half-open interval `[check_in, check_out)`, so
a same-day turnover (one guest out, the next in) is not a conflict. Cancelled
reservations release the space. ISO `YYYY-MM-DD` dates sort lexicographically, so
the date comparisons are plain text comparisons. The booking form and the front
desk both go through `assertSpaceBookable`, which rejects a space that is
missing, archived, too small for the party, or already booked for the dates.
