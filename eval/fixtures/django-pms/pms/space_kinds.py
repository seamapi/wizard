"""The kinds of bookable space a property can offer, plus their display labels."""

SPACE_KINDS = ["room", "suite", "cabin", "villa", "tent", "other"]

SPACE_KIND_LABELS = {
    "room": "Room",
    "suite": "Suite",
    "cabin": "Cabin",
    "villa": "Villa",
    "tent": "Tent",
    "other": "Space",
}

# Ready-made (value, label) pairs for Django ChoiceField / model choices.
SPACE_KIND_CHOICES = [(kind, SPACE_KIND_LABELS[kind]) for kind in SPACE_KINDS]
