"""The public booking flow: the landing page and the form that creates a stay."""

from flask import Blueprint, redirect, render_template, request, url_for
from pydantic import ValidationError

from app.availability import BookingError, assert_space_bookable
from app.db import db
from app.models import Reservation
from app.queries import list_spaces
from app.schemas import BookingInput, parse_int, parse_optional_int

bp = Blueprint("bookings", __name__)


@bp.get("/")
def home():
    """The landing page with the booking form and the list of spaces."""
    spaces = [space for space in list_spaces(db.session) if space.status == "active"]
    return render_template("index.html", spaces=spaces, error=None)


@bp.post("/book")
def book():
    """Create a reservation from the public booking form."""
    form = request.form
    try:
        data = BookingInput(
            guest_name=form.get("guest_name", ""),
            email=form.get("email", ""),
            phone=form.get("phone", ""),
            check_in=form.get("check_in", ""),
            check_out=form.get("check_out", ""),
            party_size=parse_int(form.get("party_size"), 1),
            notes=form.get("notes") or None,
            space_id=parse_optional_int(form.get("space_id")),
        )
    except ValidationError as error:
        spaces = [space for space in list_spaces(db.session) if space.status == "active"]
        return render_template("index.html", spaces=spaces, error=_first_message(error)), 422

    if data.space_id is not None:
        try:
            assert_space_bookable(
                db.session,
                space_id=data.space_id,
                check_in=data.check_in,
                check_out=data.check_out,
                party_size=data.party_size,
            )
        except BookingError as error:
            spaces = [
                space for space in list_spaces(db.session) if space.status == "active"
            ]
            return render_template("index.html", spaces=spaces, error=str(error)), 409

    reservation = Reservation(
        guest_name=data.guest_name,
        email=data.email,
        phone=data.phone,
        check_in=data.check_in,
        check_out=data.check_out,
        party_size=data.party_size,
        notes=data.notes or None,
        space_id=data.space_id,
    )
    db.session.add(reservation)
    db.session.commit()
    return redirect(url_for("reservations.reservations_page"), code=303)


def _first_message(error: ValidationError) -> str:
    first = error.errors()[0]
    return first.get("msg", "That booking looks invalid.")
