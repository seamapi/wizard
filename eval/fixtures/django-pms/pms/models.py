"""Django models: bookable spaces and the reservations held against them."""

from django.db import models

from pms.space_kinds import SPACE_KIND_CHOICES


class Space(models.Model):
    """A bookable space (room, suite, cabin…).

    Spaces are archived rather than deleted so past reservations keep pointing
    at something real.
    """

    STATUS_CHOICES = [("active", "Active"), ("archived", "Archived")]

    name = models.CharField(max_length=80, unique=True)
    kind = models.CharField(max_length=20, choices=SPACE_KIND_CHOICES, default="room")
    # Maximum party size this space sleeps.
    capacity = models.PositiveIntegerField(default=2)
    # Nightly rate in cents, or NULL when no rate has been set.
    rate_cents = models.IntegerField(null=True, blank=True, default=None)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="active")
    notes = models.TextField(null=True, blank=True, default=None)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return self.name

    @property
    def rate_display(self) -> str | None:
        """The nightly rate as whole currency units (e.g. "120.00"), or None."""
        if self.rate_cents is None:
            return None
        return f"{self.rate_cents / 100:.2f}"


class Reservation(models.Model):
    """A single reservation.

    Guest contact details are stored inline (no separate accounts / login) to
    keep the PMS minimal.
    """

    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("confirmed", "Confirmed"),
        ("cancelled", "Cancelled"),
    ]

    # Guest / user data.
    guest_name = models.CharField(max_length=200)
    email = models.EmailField()
    phone = models.CharField(max_length=50)

    # Stay details. Dates are ISO YYYY-MM-DD strings, which sort as dates.
    check_in = models.CharField(max_length=10)
    check_out = models.CharField(max_length=10)
    party_size = models.PositiveIntegerField(default=1)
    notes = models.TextField(null=True, blank=True, default=None)

    # Assigned space. Nullable: a stay can be taken before the front desk has
    # decided which space the guest gets. SET_NULL keeps the reservation row
    # valid if the space it points at is ever removed.
    space = models.ForeignKey(
        Space,
        null=True,
        blank=True,
        default=None,
        on_delete=models.SET_NULL,
        related_name="reservations",
    )

    # Lifecycle.
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self) -> str:
        return f"{self.guest_name} ({self.check_in} → {self.check_out})"
