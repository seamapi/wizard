# Rails PMS

A tiny property-management app built with [Ruby on Rails](https://rubyonrails.org/),
Active Record, and ERB views. It manages **spaces** (bookable rooms, suites,
cabins…), takes **reservations** against them, and lists the **guests** who have
booked. It is the Rails/Ruby counterpart of the FastAPI `fastapi-pms` and
Next.js `nextjs-pms` samples, with the same domain so all three exercise the
same integration.

## Getting started

```bash
bundle install
cp .env.example .env   # then fill in SEAM_API_KEY
bin/rails db:setup     # creates the SQLite database and seeds a few spaces
bin/rails server
```

Open [http://localhost:3000](http://localhost:3000). The SQLite database
(`db/development.sqlite3`) is created by `db:setup`.

## Layout

- `config/routes.rb` — the routes for each page and front-desk action.
- `app/models/space.rb` / `app/models/reservation.rb` — the Active Record models.
- `app/models/availability.rb` — overlap/capacity checks shared by booking and the front desk.
- `app/models/guest.rb` — the derived guest view (reservations deduped by email).
- `app/controllers/` — `bookings` (public form), `reservations` (front desk), `spaces` (inventory), `guests`.
- `app/views/` — the ERB pages: booking form, reservations, spaces, guests.
- `db/` — migrations, schema, and seeds.

## Pages

- `/` — the booking form (home).
- `/reservations` — the front desk: reservation cards with guest, status, dates, and the assigned space.
- `/spaces` — inventory: add spaces and archive/restore them.
- `/guests` — the deduped guest list.
