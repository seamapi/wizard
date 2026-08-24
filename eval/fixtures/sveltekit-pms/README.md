# SvelteKit PMS

A tiny property-management app built with [SvelteKit](https://svelte.dev/docs/kit)
(Svelte 5 runes), `better-sqlite3`, and Zod. It manages **spaces** (bookable
rooms, suites, cabins…), takes **reservations** against them, and lists the
**guests** who have booked. It is the SvelteKit counterpart of the `nextjs-pms`
sample, with the same domain so the two exercise the same integration.

## Getting started

```bash
npm install
cp .env.example .env   # then fill in SEAM_API_KEY
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The SQLite database
(`dev.db`) is created and seeded automatically on first run.

## Layout

- `src/routes/+page.*` — the public booking form (home).
- `src/routes/reservations/+page.*` — the front desk: every reservation with its
  guest, status, dates, and assigned space.
- `src/routes/spaces/+page.*` — the inventory: add spaces, edit, archive/restore.
- `src/routes/guests/+page.*` — the guest directory (deduped by email).
- `src/routes/+layout.svelte` — the shared header and nav.
- `src/lib/server/db.ts` — the `better-sqlite3` handle; the schema is created and
  seeded on import.
- `src/lib/server/availability.ts` — the overlap / capacity checks shared by
  booking and the front desk.
- `src/lib/server/queries.ts` — the read queries behind each page's `load`.
- `src/lib/server/actions.ts` — the write path called from each `+page.server.ts`
  form action.
- `src/lib/schemas.ts` — the Zod schemas that validate every form post.
- `src/lib/space-kinds.ts`, `src/lib/format.ts` — shared, client-safe helpers.

Everything under `src/lib/server/` is server-only: SvelteKit keeps it (and the
SQLite driver) out of the client bundle. Pages load their data in `+page.server.ts`
`load` functions and mutate through form `actions`, progressively enhanced with
`use:enhance`.
