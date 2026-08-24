"""The four PMS pages and the POST handlers behind them.

Views are function-based for clarity. Each mutation parses its input through a
form (see forms.py) and shares the availability checks in availability.py.
"""

from django.db import IntegrityError
from django.shortcuts import redirect, render

from pms.availability import BookingError, assert_space_bookable
from pms.forms import (
    AssignForm,
    BookingForm,
    SetSpaceStatusForm,
    SpaceForm,
    StatusForm,
)
from pms.models import Reservation, Space
from pms.queries import (
    list_active_spaces,
    list_guests,
    list_reservations,
    list_spaces,
)
from pms.space_kinds import SPACE_KIND_CHOICES


# --- Public booking flow -------------------------------------------------


def home(request):
    """The landing page with the booking form and the list of active spaces."""
    return render(
        request, "pms/index.html", {"spaces": list_active_spaces(), "error": None}
    )


def book(request):
    """Create a reservation from the public booking form."""
    if request.method != "POST":
        return redirect("home")

    form = BookingForm(request.POST)
    if not form.is_valid():
        return _render_booking_error(request, _first_error(form), status=422)

    space = form.cleaned_data.get("space")
    if space is not None:
        try:
            assert_space_bookable(
                space_id=space.id,
                check_in=form.cleaned_data["check_in"],
                check_out=form.cleaned_data["check_out"],
                party_size=form.cleaned_data["party_size"],
            )
        except BookingError as error:
            return _render_booking_error(request, str(error), status=409)

    form.save()
    return redirect("reservations")


# --- Front desk ----------------------------------------------------------


def reservations_page(request):
    """The front-desk list, with the spaces available for reassignment."""
    return render(
        request,
        "pms/reservations.html",
        {"reservations": list_reservations(), "spaces": list_spaces()},
    )


def guests_page(request):
    return render(request, "pms/guests.html", {"guests": list_guests()})


def update_status(request, reservation_id: int):
    """Update a reservation's status (front desk)."""
    if request.method != "POST":
        return redirect("reservations")

    form = StatusForm(request.POST)
    reservation = Reservation.objects.filter(id=reservation_id).first()
    if reservation is None or not form.is_valid():
        return redirect("reservations")

    new_status = form.cleaned_data["status"]

    # Cancelling releases the space, so reviving a cancelled stay has to win its
    # space back — someone else may have taken it in the meantime.
    if (
        reservation.status == "cancelled"
        and new_status != "cancelled"
        and reservation.space_id is not None
    ):
        try:
            assert_space_bookable(
                space_id=reservation.space_id,
                check_in=reservation.check_in,
                check_out=reservation.check_out,
                party_size=reservation.party_size,
                exclude_id=reservation.id,
            )
        except BookingError:
            return redirect("reservations")

    reservation.status = new_status
    reservation.save(update_fields=["status"])
    return redirect("reservations")


def assign_space(request, reservation_id: int):
    """Assign, move, or clear a reservation's space (front desk)."""
    if request.method != "POST":
        return redirect("reservations")

    form = AssignForm(request.POST)
    reservation = Reservation.objects.filter(id=reservation_id).first()
    if reservation is None or not form.is_valid():
        return redirect("reservations")

    space = form.cleaned_data.get("space")
    if space is not None:
        try:
            assert_space_bookable(
                space_id=space.id,
                check_in=reservation.check_in,
                check_out=reservation.check_out,
                party_size=reservation.party_size,
                exclude_id=reservation.id,
            )
        except BookingError:
            return redirect("reservations")

    reservation.space = space
    reservation.save(update_fields=["space"])
    return redirect("reservations")


def delete_reservation(request, reservation_id: int):
    """Delete a reservation (front desk)."""
    if request.method == "POST":
        Reservation.objects.filter(id=reservation_id).delete()
    return redirect("reservations")


# --- Space inventory -----------------------------------------------------


def spaces_page(request):
    return _render_spaces(request, error=None)


def create_space(request):
    if request.method != "POST":
        return redirect("spaces")

    form = SpaceForm(request.POST)
    if not form.is_valid():
        return _render_spaces(request, _first_error(form), status=422)

    try:
        Space.objects.create(**form.as_row())
    except IntegrityError:
        name = form.cleaned_data["name"]
        return _render_spaces(request, f"A space named “{name}” already exists.", status=422)
    return redirect("spaces")


def update_space(request, space_id: int):
    if request.method != "POST":
        return redirect("spaces")

    space = Space.objects.filter(id=space_id).first()
    if space is None:
        return redirect("spaces")

    form = SpaceForm(request.POST)
    if not form.is_valid():
        return _render_spaces(request, _first_error(form), status=422)

    for column, value in form.as_row().items():
        setattr(space, column, value)
    try:
        space.save()
    except IntegrityError:
        name = form.cleaned_data["name"]
        return _render_spaces(request, f"A space named “{name}” already exists.", status=422)
    return redirect("spaces")


def set_space_status(request, space_id: int):
    """Archive or restore a space. Archiving keeps it out of the booking picker
    without touching the reservations that already reference it."""
    if request.method != "POST":
        return redirect("spaces")

    form = SetSpaceStatusForm(request.POST)
    space = Space.objects.filter(id=space_id).first()
    if space is not None and form.is_valid():
        space.status = form.cleaned_data["status"]
        space.save(update_fields=["status"])
    return redirect("spaces")


# --- Private render helpers ----------------------------------------------


def _render_booking_error(request, message: str, *, status: int):
    return render(
        request,
        "pms/index.html",
        {"spaces": list_active_spaces(), "error": message},
        status=status,
    )


def _render_spaces(request, error: str | None, *, status: int = 200):
    return render(
        request,
        "pms/spaces.html",
        {"spaces": list_spaces(), "kinds": SPACE_KIND_CHOICES, "error": error},
        status=status,
    )


def _first_error(form) -> str:
    """The first human-readable validation message on a bound form."""
    for errors in form.errors.values():
        if errors:
            return errors[0]
    return "That input looks invalid."
