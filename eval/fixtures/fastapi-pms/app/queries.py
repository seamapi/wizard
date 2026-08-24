"""Read queries behind each page, plus the derived guest view."""

from dataclasses import dataclass

from sqlalchemy import asc, desc, select
from sqlalchemy.orm import Session

from app.models import Reservation, Space


@dataclass
class Guest:
    name: str
    email: str
    phone: str
    reservation_count: int


def list_reservations(db: Session) -> list[Reservation]:
    """All reservations, newest first. The assigned space is available via the
    relationship (`reservation.space`)."""
    return list(
        db.execute(select(Reservation).order_by(desc(Reservation.created_at)))
        .scalars()
        .all()
    )


def list_guests(db: Session) -> list[Guest]:
    """Unique guests (deduped by email), with how many reservations each has."""
    rows = (
        db.execute(select(Reservation).order_by(desc(Reservation.created_at)))
        .scalars()
        .all()
    )

    by_email: dict[str, Guest] = {}
    for reservation in rows:
        key = reservation.email.strip().lower()
        existing = by_email.get(key)
        if existing is not None:
            existing.reservation_count += 1
        else:
            # rows are newest-first, so the first hit is the guest's latest details
            by_email[key] = Guest(
                name=reservation.guest_name,
                email=reservation.email,
                phone=reservation.phone,
                reservation_count=1,
            )
    return list(by_email.values())


def list_spaces(db: Session) -> list[Space]:
    """Every space, active first then alphabetical."""
    return list(
        db.execute(select(Space).order_by(asc(Space.status), asc(Space.name)))
        .scalars()
        .all()
    )
