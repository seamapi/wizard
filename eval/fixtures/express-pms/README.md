# Express PMS

A tiny property-management app built with [Express](https://expressjs.com/),
`better-sqlite3` (raw SQL, no ORM), and EJS server-rendered views. It manages
**spaces** (bookable rooms, suites, cabins…), takes **reservations** against
them, and lists the **guests** who have booked. It is the Express counterpart of
the Next.js `nextjs-pms` sample, with the same domain so the two exercise the
same integration.

## Getting started

```bash
npm install
cp .env.example .env   # then fill in SEAM_API_KEY
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The SQLite database
(`pms.db`) is created automatically on first run.

## Layout

- `src/server.ts` — the Express app; wires EJS, body parsing, and the routers.
- `src/db.ts` — the `better-sqlite3` connection and the schema it creates on boot.
- `src/schemas.ts` — zod request schemas, validated on every form post.
- `src/availability.ts` — overlap/capacity checks shared by booking and the front desk.
- `src/queries.ts` — the read queries behind each page.
- `src/routes/` — `bookings` (public form), `reservations` (front desk), `spaces` (inventory).
- `views/` — the EJS pages: booking form, reservations, spaces, guests.
