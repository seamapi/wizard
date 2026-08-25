# Laravel PMS

A tiny property-management app built with [Laravel](https://laravel.com/),
Eloquent, and Blade templates. It manages **spaces** (bookable rooms, suites,
cabins…), takes **reservations** against them, and lists the **guests** who have
booked. It is the Laravel/PHP counterpart of the FastAPI `fastapi-pms` and
Next.js `nextjs-pms` samples, with the same domain so the three exercise the
same integration.

## Getting started

```bash
composer install
cp .env.example .env        # then fill in SEAM_API_KEY
php artisan key:generate    # sets APP_KEY
php artisan migrate --seed  # creates database/database.sqlite and seeds a few spaces
php artisan serve
```

Open [http://localhost:8000](http://localhost:8000). The SQLite database
(`database/database.sqlite`) is created by `php artisan migrate`. Running with
`--seed` adds a few example spaces so the booking form's picker isn't empty; use
plain `php artisan migrate` if you'd rather start with none.

## Layout

- `routes/web.php` — the routes for every page and form post.
- `app/Models/` — the `Space` and `Reservation` Eloquent models.
- `app/Http/Controllers/` — `BookingController` (public form), `ReservationController`
  (front desk), `SpaceController` (inventory), `GuestController` (derived list).
- `app/Services/AvailabilityService.php` — overlap/capacity checks shared by
  booking and the front desk.
- `app/Exceptions/BookingException.php` — the guest-readable "can't book" error.
- `app/SpaceKinds.php` — the kinds of space and their display labels.
- `database/migrations/` — the `spaces` and `reservations` schema.
- `database/seeders/DatabaseSeeder.php` — a few starter spaces.
- `resources/views/` — the Blade pages: booking form, reservations, spaces, guests.
