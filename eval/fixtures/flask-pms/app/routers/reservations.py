"""The front desk: list reservations, change status, assign a space, delete.

Also serves the derived guests page.
"""

from flask import Blueprint, redirect, render_template, request, url_for

from app.availability import BookingError, assert_space_bookable
from app.db import db
from app.models import Reservation
from app.queries import list_guests, list_reservations, list_spaces
from app.schemas import AssignInput, StatusInput, parse_optional_int

bp = Blueprint("reservations", __name__)


@bp.get("/reservations")
def reservations_page():
    """The front-desk list, with the spaces available for reassignment."""
    reservations = list_reservations(db.session)
    spaces = list_spaces(db.session)
    return render_template(
        "reservations.html", reservations=reservations, spaces=spaces
    )


@bp.get("/guests")
def guests_page():
    return render_template("guests.html", guests=list_guests(db.session))


@bp.post("/reservations/<int:reservation_id>/status")
def update_status(reservation_id: int):
    """Update a reservation's status (front desk)."""
    data = StatusInput(status=request.form.get("status", ""))
    reservation = db.session.get(Reservation, reservation_id)
    if reservation is None:
        return redirect(url_for("reservations.reservations_page"), code=303)

    # Cancelling releases the space, so reviving a cancelled stay has to win its
    # space back — someone else may have taken it in the meantime.
    if (
        reservation.status == "cancelled"
        and data.status != "cancelled"
        and reservation.space_id is not None
    ):
        try:
            assert_space_bookable(
                db.session,
                space_id=reservation.space_id,
                check_in=reservation.check_in,
                check_out=reservation.check_out,
                party_size=reservation.party_size,
                exclude_reservation_id=reservation.id,
            )
        except BookingError:
            return redirect(url_for("reservations.reservations_page"), code=303)

    reservation.status = data.status
    db.session.commit()
    return redirect(url_for("reservations.reservations_page"), code=303)


@bp.post("/reservations/<int:reservation_id>/assign")
def assign_space(reservation_id: int):
    """Assign, move, or clear a reservation's space (front desk)."""
    data = AssignInput(space_id=parse_optional_int(request.form.get("space_id")))
    reservation = db.session.get(Reservation, reservation_id)
    if reservation is None:
        return redirect(url_for("reservations.reservations_page"), code=303)

    if data.space_id is not None:
        try:
            assert_space_bookable(
                db.session,
                space_id=data.space_id,
                check_in=reservation.check_in,
                check_out=reservation.check_out,
                party_size=reservation.party_size,
                exclude_reservation_id=reservation.id,
            )
        except BookingError:
            return redirect(url_for("reservations.reservations_page"), code=303)

    reservation.space_id = data.space_id
    db.session.commit()
    return redirect(url_for("reservations.reservations_page"), code=303)


@bp.post("/reservations/<int:reservation_id>/delete")
def delete_reservation(reservation_id: int):
    """Delete a reservation (front desk)."""
    reservation = db.session.get(Reservation, reservation_id)
    if reservation is not None:
        db.session.delete(reservation)
        db.session.commit()
    return redirect(url_for("reservations.reservations_page"), code=303)
