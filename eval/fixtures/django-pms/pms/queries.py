"""Read queries behind each page, plus the derived guest view."""

from dataclasses import dataclass

from pms.availability import booked_space_ids
from pms.models import Reservation, Space


@dataclass
class Guest:
    name: str
    email: str
    phone: str
    reservation_count: int


@dataclass
class SpaceAvailability:
    space: Space
    is_available: bool


def list_reservations() -> list[Reservation]:
    """All reservations, newest first. The assigned space is available via the
    relationship (`reservation.space`)."""
    return list(
        Reservation.objects.select_related("space").order_by("-created_at")
    )


def list_guests() -> list[Guest]:
    """Unique guests (deduped by lowercased email), with how many reservations
    each has."""
    by_email: dict[str, Guest] = {}
    # Newest-first, so the first hit for an email is the guest's latest details.
    for reservation in Reservation.objects.order_by("-created_at"):
        key = reservation.email.strip().lower()
        existing = by_email.get(key)
        if existing is not None:
            existing.reservation_count += 1
        else:
            by_email[key] = Guest(
                name=reservation.guest_name,
                email=reservation.email,
                phone=reservation.phone,
                reservation_count=1,
            )
    return list(by_email.values())


def list_spaces() -> list[Space]:
    """Every space, active first then alphabetical."""
    return list(Space.objects.order_by("status", "name"))


def list_active_spaces() -> list[Space]:
    """Only spaces that can currently be booked."""
    return list(Space.objects.filter(status="active").order_by("name"))


def list_space_availability(
    check_in: str, check_out: str, party_size: int
) -> list[SpaceAvailability]:
    """Each active space paired with whether it can take the given stay."""
    held = booked_space_ids(check_in, check_out)
    return [
        SpaceAvailability(
            space=space,
            is_available=space.id not in held and party_size <= space.capacity,
        )
        for space in list_active_spaces()
    ]
