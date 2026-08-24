"""Pydantic request models plus the form-coercion helpers they need.

Every form post is parsed through one of these before it reaches the database,
so validation lives in one place and route handlers work with typed data. Flask
hands form values in as strings, so the helpers below turn the raw
``request.form`` values into the ints (and Nones) the models expect.
"""

from typing import Literal

from pydantic import BaseModel, EmailStr, Field, model_validator

from app.space_kinds import SPACE_KINDS

SpaceKind = Literal["room", "suite", "cabin", "villa", "tent", "other"]
ReservationStatus = Literal["pending", "confirmed", "cancelled"]
SpaceStatus = Literal["active", "archived"]


def parse_int(raw: str | None, default: int) -> int:
    """Coerce a form value to int, falling back when it is missing or blank."""
    if raw is None or raw.strip() == "":
        return default
    return int(raw)


def parse_optional_int(raw: str | None) -> int | None:
    """Coerce a form value to int, treating missing / blank as None."""
    if raw is None or raw.strip() == "":
        return None
    return int(raw)


def parse_optional_float(raw: str | None) -> float | None:
    """Coerce a form value to float, treating missing / blank as None."""
    if raw is None or raw.strip() == "":
        return None
    return float(raw)


class BookingInput(BaseModel):
    """The public booking form."""

    guest_name: str = Field(min_length=1)
    email: EmailStr
    phone: str = Field(min_length=5)
    check_in: str = Field(min_length=1)
    check_out: str = Field(min_length=1)
    party_size: int = Field(default=1, ge=1, le=20)
    notes: str | None = Field(default=None, max_length=1000)
    # None = let the front desk assign a space later.
    space_id: int | None = None

    @model_validator(mode="after")
    def check_out_after_check_in(self) -> "BookingInput":
        if self.check_out <= self.check_in:
            raise ValueError("Check-out must be after check-in")
        return self


class StatusInput(BaseModel):
    status: ReservationStatus


class AssignInput(BaseModel):
    space_id: int | None = None


class SpaceInput(BaseModel):
    """The space create / edit form."""

    name: str = Field(min_length=1, max_length=80)
    kind: SpaceKind = "room"
    capacity: int = Field(default=2, ge=1, le=40)
    # Nightly rate in whole currency units; None means "no rate set".
    rate: float | None = Field(default=None, ge=0, le=1_000_000)
    notes: str | None = Field(default=None, max_length=500)

    def as_row(self) -> dict:
        """Column values for a Space, converting the rate to integer cents."""
        return {
            "name": self.name,
            "kind": self.kind if self.kind in SPACE_KINDS else "room",
            "capacity": self.capacity,
            "rate_cents": None if self.rate is None else round(self.rate * 100),
            "notes": self.notes or None,
        }


class SetSpaceStatusInput(BaseModel):
    status: SpaceStatus


class AvailabilityInput(BaseModel):
    check_in: str = Field(min_length=1)
    check_out: str = Field(min_length=1)
    party_size: int = Field(ge=1)
