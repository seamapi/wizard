"""Space inventory: create, edit, and archive/restore bookable spaces."""

from fastapi import APIRouter, Depends, Form, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from pydantic import ValidationError
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Space
from app.queries import list_spaces
from app.schemas import SetSpaceStatusInput, SpaceInput
from app.space_kinds import SPACE_KINDS
from app.templates import templates

router = APIRouter()


@router.get("/spaces", response_class=HTMLResponse)
def spaces_page(request: Request, db: Session = Depends(get_db)) -> HTMLResponse:
    return templates.TemplateResponse(
        request,
        "spaces.html",
        {"spaces": list_spaces(db), "kinds": SPACE_KINDS, "error": None},
    )


@router.post("/spaces")
def create_space(
    request: Request,
    name: str = Form(...),
    kind: str = Form("room"),
    capacity: int = Form(2),
    rate: float | None = Form(None),
    notes: str | None = Form(None),
    db: Session = Depends(get_db),
):
    try:
        data = SpaceInput(name=name, kind=kind, capacity=capacity, rate=rate, notes=notes)
    except ValidationError as error:
        return _render_error(request, db, _first_message(error))

    space = Space(**data.as_row())
    db.add(space)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        return _render_error(request, db, f"A space named “{name}” already exists.")
    return RedirectResponse("/spaces", status_code=303)


@router.post("/spaces/{space_id}")
def update_space(
    request: Request,
    space_id: int,
    name: str = Form(...),
    kind: str = Form("room"),
    capacity: int = Form(2),
    rate: float | None = Form(None),
    notes: str | None = Form(None),
    db: Session = Depends(get_db),
):
    space = db.get(Space, space_id)
    if space is None:
        return RedirectResponse("/spaces", status_code=303)

    try:
        data = SpaceInput(name=name, kind=kind, capacity=capacity, rate=rate, notes=notes)
    except ValidationError as error:
        return _render_error(request, db, _first_message(error))

    for column, value in data.as_row().items():
        setattr(space, column, value)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        return _render_error(request, db, f"A space named “{name}” already exists.")
    return RedirectResponse("/spaces", status_code=303)


@router.post("/spaces/{space_id}/status")
def set_space_status(
    space_id: int,
    status: str = Form(...),
    db: Session = Depends(get_db),
):
    """Archive or restore a space. Archiving keeps it out of the booking picker
    without touching the reservations that already reference it."""
    data = SetSpaceStatusInput(status=status)
    space = db.get(Space, space_id)
    if space is not None:
        space.status = data.status
        db.commit()
    return RedirectResponse("/spaces", status_code=303)


def _render_error(request: Request, db: Session, message: str) -> HTMLResponse:
    return templates.TemplateResponse(
        request,
        "spaces.html",
        {"spaces": list_spaces(db), "kinds": SPACE_KINDS, "error": message},
        status_code=422,
    )


def _first_message(error: ValidationError) -> str:
    first = error.errors()[0]
    return first.get("msg", "That space looks invalid.")
