"""Form validation: every mutation is parsed through one of these first.

Keeping validation here means the views work with already-clean data and the
same rules apply no matter which page posts the form.
"""

from django import forms

from pms.models import Reservation, Space
from pms.space_kinds import SPACE_KINDS, SPACE_KIND_CHOICES

RESERVATION_STATUSES = ["pending", "confirmed", "cancelled"]
SPACE_STATUSES = ["active", "archived"]


class BookingForm(forms.ModelForm):
    """The public booking form. `space` is optional — leaving it blank lets the
    front desk assign a space later."""

    # Declared explicitly (rather than derived from the model) so the bounds are
    # enforced as validators, not just as HTML hints.
    guest_name = forms.CharField(min_length=1, max_length=200)
    phone = forms.CharField(min_length=5, max_length=50)
    party_size = forms.IntegerField(min_value=1, max_value=20, initial=1)
    notes = forms.CharField(max_length=1000, required=False)

    class Meta:
        model = Reservation
        fields = [
            "guest_name",
            "email",
            "phone",
            "check_in",
            "check_out",
            "party_size",
            "notes",
            "space",
        ]

    def __init__(self, *args, **kwargs) -> None:
        super().__init__(*args, **kwargs)
        self.fields["space"].required = False
        # Only active spaces are directly bookable from the public form.
        self.fields["space"].queryset = Space.objects.filter(status="active")

    def clean(self) -> dict:
        cleaned = super().clean()
        check_in = cleaned.get("check_in")
        check_out = cleaned.get("check_out")
        if check_in and check_out and check_out <= check_in:
            raise forms.ValidationError("Check-out must be after check-in.")
        return cleaned


class SpaceForm(forms.Form):
    """The space create / edit form."""

    name = forms.CharField(min_length=1, max_length=80)
    kind = forms.ChoiceField(choices=SPACE_KIND_CHOICES, initial="room")
    capacity = forms.IntegerField(min_value=1, max_value=40, initial=2)
    # Nightly rate in whole currency units; blank means "no rate set".
    rate = forms.FloatField(min_value=0, max_value=1_000_000, required=False)
    notes = forms.CharField(max_length=500, required=False)

    def as_row(self) -> dict:
        """Column values for a Space, converting the rate to integer cents."""
        data = self.cleaned_data
        kind = data["kind"] if data["kind"] in SPACE_KINDS else "room"
        rate = data.get("rate")
        return {
            "name": data["name"],
            "kind": kind,
            "capacity": data["capacity"],
            "rate_cents": None if rate is None else round(rate * 100),
            "notes": data.get("notes") or None,
        }


class StatusForm(forms.Form):
    status = forms.ChoiceField(choices=[(value, value) for value in RESERVATION_STATUSES])


class AssignForm(forms.Form):
    # Blank clears the assignment.
    space = forms.ModelChoiceField(queryset=Space.objects.all(), required=False)


class SetSpaceStatusForm(forms.Form):
    status = forms.ChoiceField(choices=[(value, value) for value in SPACE_STATUSES])
