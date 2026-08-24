# FastAPI PMS

A tiny property-management app built with [FastAPI](https://fastapi.tiangolo.com/),
SQLAlchemy, and Jinja2 templates. It manages **spaces** (bookable rooms, suites,
cabins…), takes **reservations** against them, and lists the **guests** who have
booked. It is the FastAPI/Python counterpart of the Next.js `nextjs-pms`
sample, with the same domain so the two exercise the same integration.

## Getting started

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # then fill in SEAM_API_KEY
uvicorn main:app --reload
```

Open [http://localhost:8000](http://localhost:8000). The SQLite database
(`pms.db`) is created automatically on first run.

## Layout

- `main.py` — the FastAPI app; mounts the routers and Jinja templates.
- `app/models.py` — the `Space` and `Reservation` SQLAlchemy models.
- `app/schemas.py` — Pydantic request models, validated on every form post.
- `app/availability.py` — overlap/capacity checks shared by booking and the front desk.
- `app/queries.py` — the read queries behind each page.
- `app/routers/` — `bookings` (public form), `reservations` (front desk), `spaces` (inventory).
- `templates/` — the Jinja pages: booking form, reservations, spaces, guests.
