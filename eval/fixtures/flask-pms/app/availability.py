"""Availability helpers shared by booking and front-desk reassignment."""

from sqlalchemy import and_, select
from sqlalchemy.orm import Session

from app.models import Reservation, Space


class BookingError(Exception):
    """A guest-readable reason a space can't take a stay."""


def _overlap_clause(check_in: str, check_out: str):
    """Reservations hold a space for the half-open interval [check_in, check_out),
    so a same-day turnover (one guest out, the next in) is not a conflict.
    Cancelled reservations release the space.
    """
    return and_(
        Reservation.space_id.is_not(None),
        Reservation.status != "cancelled",
        # ISO YYYY-MM-DD sorts lexicographically, so text compare is date compare.
        Reservation.check_in < check_out,
        Reservation.check_out > check_in,
    )


def booked_space_ids(
    session: Session,
    check_in: str,
    check_out: str,
    exclude_reservation_id: int | None = None,
) -> set[int]:
    """Space ids already held for the given range, excluding one reservation."""
    clause = _overlap_clause(check_in, check_out)
    if exclude_reservation_id is not None:
        clause = and_(clause, Reservation.id != exclude_reservation_id)

    held = session.execute(select(Reservation.space_id).where(clause)).scalars().all()
    return {space_id for space_id in held if space_id is not None}


def assert_space_bookable(
    session: Session,
    *,
    space_id: int,
    check_in: str,
    check_out: str,
    party_size: int,
    exclude_reservation_id: int | None = None,
) -> Space:
    """Assert a space can take a stay, raising BookingError if not."""
    space = session.get(Space, space_id)
    if space is None:
        raise BookingError("That space no longer exists.")
    if space.status != "active":
        raise BookingError(f"{space.name} is archived and can't be booked.")
    if party_size > space.capacity:
        raise BookingError(
            f"{space.name} sleeps {space.capacity}, but this stay is for {party_size}."
        )

    booked = booked_space_ids(session, check_in, check_out, exclude_reservation_id)
    if space_id in booked:
        raise BookingError(f"{space.name} is already booked for those dates.")

    return space
