# Django PMS

A tiny property-management app built with [Django](https://www.djangoproject.com/)
and its ORM + templates. It manages **spaces** (bookable rooms, suites, cabins…),
takes **reservations** against them, and lists the **guests** who have booked. It
is the Django/Python counterpart of the FastAPI `fastapi-pms` and Next.js
`nextjs-pms` samples, with the same domain so the three exercise the same
integration.

## Getting started

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # then fill in SEAM_API_KEY
python manage.py migrate
python manage.py runserver
```

Open [http://localhost:8000](http://localhost:8000). The SQLite database
(`db.sqlite3`) is created by `manage.py migrate`.

## Layout

- `manage.py` — Django's management CLI.
- `config/` — the project: `settings.py`, `urls.py`, `wsgi.py`, `asgi.py`.
- `pms/models.py` — the `Space` and `Reservation` models.
- `pms/forms.py` — form validation, run on every mutation.
- `pms/availability.py` — overlap/capacity checks shared by booking and the front desk.
- `pms/queries.py` — the read queries behind each page, plus the derived guest view.
- `pms/space_kinds.py` — the kinds of bookable space and their labels.
- `pms/views.py` — the four pages and the POST handlers behind them.
- `pms/urls.py` — the route table.
- `pms/templates/pms/` — the pages: booking form, reservations, spaces, guests.

## Pages

- `/` — the public booking form.
- `/reservations` — the front desk: confirm/cancel, assign or move a space, delete.
- `/spaces` — inventory: add a space, archive or restore one.
- `/guests` — unique guests, deduped by email.
