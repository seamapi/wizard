"""Availability helpers shared by booking and front-desk reassignment."""

from pms.models import Reservation, Space


class BookingError(Exception):
    """A guest-readable reason a space can't take a stay."""


def booked_space_ids(
    check_in: str,
    check_out: str,
    exclude_id: int | None = None,
) -> set[int]:
    """Space ids already held for the given range, excluding one reservation.

    Reservations hold a space for the half-open interval [check_in, check_out),
    so a same-day turnover (one guest out, the next in) is not a conflict.
    Cancelled reservations release the space. ISO YYYY-MM-DD sorts
    lexicographically, so text compare is date compare.
    """
    overlapping = (
        Reservation.objects.filter(space_id__isnull=False)
        .exclude(status="cancelled")
        .filter(check_in__lt=check_out, check_out__gt=check_in)
    )
    if exclude_id is not None:
        overlapping = overlapping.exclude(id=exclude_id)

    return set(overlapping.values_list("space_id", flat=True))


def assert_space_bookable(
    *,
    space_id: int,
    check_in: str,
    check_out: str,
    party_size: int,
    exclude_id: int | None = None,
) -> Space:
    """Assert a space can take a stay, raising BookingError if not."""
    space = Space.objects.filter(id=space_id).first()
    if space is None:
        raise BookingError("That space no longer exists.")
    if space.status != "active":
        raise BookingError(f"{space.name} is archived and can't be booked.")
    if party_size > space.capacity:
        raise BookingError(
            f"{space.name} sleeps {space.capacity}, but this stay is for {party_size}."
        )

    if space_id in booked_space_ids(check_in, check_out, exclude_id):
        raise BookingError(f"{space.name} is already booked for those dates.")

    return space
