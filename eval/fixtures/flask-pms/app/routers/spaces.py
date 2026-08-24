"""Space inventory: create, edit, and archive/restore bookable spaces."""

from flask import Blueprint, redirect, render_template, request, url_for
from pydantic import ValidationError
from sqlalchemy.exc import IntegrityError

from app.db import db
from app.models import Space
from app.queries import list_spaces
from app.schemas import (
    SetSpaceStatusInput,
    SpaceInput,
    parse_int,
    parse_optional_float,
)
from app.space_kinds import SPACE_KINDS

bp = Blueprint("spaces", __name__)


@bp.get("/spaces")
def spaces_page():
    return render_template(
        "spaces.html", spaces=list_spaces(db.session), kinds=SPACE_KINDS, error=None
    )


@bp.post("/spaces")
def create_space():
    form = request.form
    try:
        data = SpaceInput(
            name=form.get("name", ""),
            kind=form.get("kind", "room"),
            capacity=parse_int(form.get("capacity"), 2),
            rate=parse_optional_float(form.get("rate")),
            notes=form.get("notes") or None,
        )
    except ValidationError as error:
        return _render_error(_first_message(error))

    space = Space(**data.as_row())
    db.session.add(space)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return _render_error(f"A space named “{form.get('name', '')}” already exists.")
    return redirect(url_for("spaces.spaces_page"), code=303)


@bp.post("/spaces/<int:space_id>")
def update_space(space_id: int):
    space = db.session.get(Space, space_id)
    if space is None:
        return redirect(url_for("spaces.spaces_page"), code=303)

    form = request.form
    try:
        data = SpaceInput(
            name=form.get("name", ""),
            kind=form.get("kind", "room"),
            capacity=parse_int(form.get("capacity"), 2),
            rate=parse_optional_float(form.get("rate")),
            notes=form.get("notes") or None,
        )
    except ValidationError as error:
        return _render_error(_first_message(error))

    for column, value in data.as_row().items():
        setattr(space, column, value)
    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        return _render_error(f"A space named “{form.get('name', '')}” already exists.")
    return redirect(url_for("spaces.spaces_page"), code=303)


@bp.post("/spaces/<int:space_id>/status")
def set_space_status(space_id: int):
    """Archive or restore a space. Archiving keeps it out of the booking picker
    without touching the reservations that already reference it."""
    data = SetSpaceStatusInput(status=request.form.get("status", ""))
    space = db.session.get(Space, space_id)
    if space is not None:
        space.status = data.status
        db.session.commit()
    return redirect(url_for("spaces.spaces_page"), code=303)


def _render_error(message: str):
    return (
        render_template(
            "spaces.html", spaces=list_spaces(db.session), kinds=SPACE_KINDS, error=message
        ),
        422,
    )


def _first_message(error: ValidationError) -> str:
    first = error.errors()[0]
    return first.get("msg", "That space looks invalid.")
