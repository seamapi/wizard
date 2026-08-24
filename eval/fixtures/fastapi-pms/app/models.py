"""SQLAlchemy models: bookable spaces and the reservations held against them."""

from datetime import datetime, timezone

from sqlalchemy import ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Space(Base):
    """A bookable space (room, suite, cabin…).

    Spaces are archived rather than deleted so past reservations keep pointing
    at something real.
    """

    __tablename__ = "spaces"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(unique=True)
    kind: Mapped[str] = mapped_column(default="room")
    # Maximum party size this space sleeps.
    capacity: Mapped[int] = mapped_column(default=2)
    # Nightly rate in cents, or NULL when no rate has been set.
    rate_cents: Mapped[int | None] = mapped_column(default=None)
    status: Mapped[str] = mapped_column(default="active")
    notes: Mapped[str | None] = mapped_column(default=None)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now(), default=_now)

    reservations: Mapped[list["Reservation"]] = relationship(back_populates="space")


class Reservation(Base):
    """A single reservation.

    Guest contact details are stored inline (no separate accounts / login) to
    keep the PMS minimal.
    """

    __tablename__ = "reservations"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    # Guest / user data.
    guest_name: Mapped[str]
    email: Mapped[str]
    phone: Mapped[str]

    # Stay details. Dates are ISO YYYY-MM-DD strings, which sort as dates.
    check_in: Mapped[str]
    check_out: Mapped[str]
    party_size: Mapped[int] = mapped_column(default=1)
    notes: Mapped[str | None] = mapped_column(default=None)

    # Assigned space. Nullable: a stay can be taken before the front desk has
    # decided which space the guest gets. Clearing the space on delete keeps the
    # reservation row valid.
    space_id: Mapped[int | None] = mapped_column(
        ForeignKey("spaces.id", ondelete="SET NULL"), default=None
    )

    # Lifecycle.
    status: Mapped[str] = mapped_column(default="pending")
    created_at: Mapped[datetime] = mapped_column(server_default=func.now(), default=_now)

    space: Mapped[Space | None] = relationship(back_populates="reservations")
