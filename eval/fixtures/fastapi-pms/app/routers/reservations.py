"""The front desk: list reservations, change status, assign a space, delete.

Also serves the derived guests page.
"""

from fastapi import APIRouter, Depends, Form, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy.orm import Session

from app.availability import BookingError, assert_space_bookable
from app.db import get_db
from app.models import Reservation
from app.queries import list_guests, list_reservations, list_spaces
from app.schemas import AssignInput, StatusInput
from app.templates import templates

router = APIRouter()


@router.get("/reservations", response_class=HTMLResponse)
def reservations_page(request: Request, db: Session = Depends(get_db)) -> HTMLResponse:
    """The front-desk list, with the spaces available for reassignment."""
    reservations = list_reservations(db)
    spaces = list_spaces(db)
    return templates.TemplateResponse(
        request,
        "reservations.html",
        {"reservations": reservations, "spaces": spaces},
    )


@router.get("/guests", response_class=HTMLResponse)
def guests_page(request: Request, db: Session = Depends(get_db)) -> HTMLResponse:
    return templates.TemplateResponse(
        request, "guests.html", {"guests": list_guests(db)}
    )


@router.post("/reservations/{reservation_id}/status")
def update_status(
    reservation_id: int,
    status: str = Form(...),
    db: Session = Depends(get_db),
):
    """Update a reservation's status (front desk)."""
    data = StatusInput(status=status)
    reservation = db.get(Reservation, reservation_id)
    if reservation is None:
        return RedirectResponse("/reservations", status_code=303)

    # Cancelling releases the space, so reviving a cancelled stay has to win its
    # space back — someone else may have taken it in the meantime.
    if (
        reservation.status == "cancelled"
        and data.status != "cancelled"
        and reservation.space_id is not None
    ):
        try:
            assert_space_bookable(
                db,
                space_id=reservation.space_id,
                check_in=reservation.check_in,
                check_out=reservation.check_out,
                party_size=reservation.party_size,
                exclude_reservation_id=reservation.id,
            )
        except BookingError:
            return RedirectResponse("/reservations", status_code=303)

    reservation.status = data.status
    db.commit()
    return RedirectResponse("/reservations", status_code=303)


@router.post("/reservations/{reservation_id}/assign")
def assign_space(
    reservation_id: int,
    space_id: int | None = Form(None),
    db: Session = Depends(get_db),
):
    """Assign, move, or clear a reservation's space (front desk)."""
    data = AssignInput(space_id=space_id)
    reservation = db.get(Reservation, reservation_id)
    if reservation is None:
        return RedirectResponse("/reservations", status_code=303)

    if data.space_id is not None:
        try:
            assert_space_bookable(
                db,
                space_id=data.space_id,
                check_in=reservation.check_in,
                check_out=reservation.check_out,
                party_size=reservation.party_size,
                exclude_reservation_id=reservation.id,
            )
        except BookingError:
            return RedirectResponse("/reservations", status_code=303)

    reservation.space_id = data.space_id
    db.commit()
    return RedirectResponse("/reservations", status_code=303)


@router.post("/reservations/{reservation_id}/delete")
def delete_reservation(reservation_id: int, db: Session = Depends(get_db)):
    """Delete a reservation (front desk)."""
    reservation = db.get(Reservation, reservation_id)
    if reservation is not None:
        db.delete(reservation)
        db.commit()
    return RedirectResponse("/reservations", status_code=303)
