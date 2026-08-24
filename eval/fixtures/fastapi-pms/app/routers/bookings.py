"""The public booking flow: the landing page and the form that creates a stay."""

from fastapi import APIRouter, Depends, Form, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.availability import BookingError, assert_space_bookable
from app.db import get_db
from app.models import Reservation
from app.queries import list_spaces
from app.schemas import BookingInput
from app.templates import templates

router = APIRouter()


@router.get("/", response_class=HTMLResponse)
def home(request: Request, db: Session = Depends(get_db)) -> HTMLResponse:
    """The landing page with the booking form and the list of spaces."""
    spaces = [space for space in list_spaces(db) if space.status == "active"]
    return templates.TemplateResponse(
        request, "index.html", {"spaces": spaces, "error": None}
    )


@router.post("/book")
def book(
    request: Request,
    guest_name: str = Form(...),
    email: str = Form(...),
    phone: str = Form(...),
    check_in: str = Form(...),
    check_out: str = Form(...),
    party_size: int = Form(1),
    notes: str | None = Form(None),
    space_id: int | None = Form(None),
    db: Session = Depends(get_db),
):
    """Create a reservation from the public booking form."""
    try:
        data = BookingInput(
            guest_name=guest_name,
            email=email,
            phone=phone,
            check_in=check_in,
            check_out=check_out,
            party_size=party_size,
            notes=notes,
            space_id=space_id,
        )
    except ValidationError as error:
        spaces = [space for space in list_spaces(db) if space.status == "active"]
        return templates.TemplateResponse(
            request,
            "index.html",
            {"spaces": spaces, "error": _first_message(error)},
            status_code=422,
        )

    if data.space_id is not None:
        try:
            assert_space_bookable(
                db,
                space_id=data.space_id,
                check_in=data.check_in,
                check_out=data.check_out,
                party_size=data.party_size,
            )
        except BookingError as error:
            spaces = [space for space in list_spaces(db) if space.status == "active"]
            return templates.TemplateResponse(
                request,
                "index.html",
                {"spaces": spaces, "error": str(error)},
                status_code=409,
            )

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
    db.add(reservation)
    db.commit()
    return RedirectResponse("/reservations", status_code=303)


def _first_message(error: ValidationError) -> str:
    first = error.errors()[0]
    return first.get("msg", "That booking looks invalid.")
