# Flask PMS

A tiny property-management app built with [Flask](https://flask.palletsprojects.com/),
Flask-SQLAlchemy, and Jinja2 templates. It manages **spaces** (bookable rooms,
suites, cabins…), takes **reservations** against them, and lists the **guests**
who have booked. It is the Flask/Python counterpart of the `fastapi-pms` and
Next.js `nextjs-pms` samples, with the same domain so the three exercise the
same integration.

## Getting started

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # then fill in SEAM_API_KEY
flask --app wsgi run --port 8000
```

Or run the entry point directly: `python wsgi.py`.

Open [http://localhost:8000](http://localhost:8000). The SQLite database
(`pms.db`) is created automatically on first run.

## Layout

- `wsgi.py` — the WSGI entry point; builds the app via the application factory.
- `app/__init__.py` — `create_app()`: config, Flask-SQLAlchemy, blueprints.
- `app/models.py` — the `Space` and `Reservation` SQLAlchemy models.
- `app/schemas.py` — Pydantic request models, validated on every form post.
- `app/availability.py` — overlap/capacity checks shared by booking and the front desk.
- `app/queries.py` — the read queries behind each page.
- `app/routers/` — blueprints: `bookings` (public form), `reservations` (front desk), `spaces` (inventory).
- `app/templates/` — the Jinja pages: booking form, reservations, spaces, guests.
