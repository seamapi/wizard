"""Initial schema: spaces and the reservations held against them."""

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="Space",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("name", models.CharField(max_length=80, unique=True)),
                (
                    "kind",
                    models.CharField(
                        choices=[
                            ("room", "Room"),
                            ("suite", "Suite"),
                            ("cabin", "Cabin"),
                            ("villa", "Villa"),
                            ("tent", "Tent"),
                            ("other", "Space"),
                        ],
                        default="room",
                        max_length=20,
                    ),
                ),
                ("capacity", models.PositiveIntegerField(default=2)),
                ("rate_cents", models.IntegerField(blank=True, default=None, null=True)),
                (
                    "status",
                    models.CharField(
                        choices=[("active", "Active"), ("archived", "Archived")],
                        default="active",
                        max_length=20,
                    ),
                ),
                ("notes", models.TextField(blank=True, default=None, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
            ],
        ),
        migrations.CreateModel(
            name="Reservation",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("guest_name", models.CharField(max_length=200)),
                ("email", models.EmailField(max_length=254)),
                ("phone", models.CharField(max_length=50)),
                ("check_in", models.CharField(max_length=10)),
                ("check_out", models.CharField(max_length=10)),
                ("party_size", models.PositiveIntegerField(default=1)),
                ("notes", models.TextField(blank=True, default=None, null=True)),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("pending", "Pending"),
                            ("confirmed", "Confirmed"),
                            ("cancelled", "Cancelled"),
                        ],
                        default="pending",
                        max_length=20,
                    ),
                ),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "space",
                    models.ForeignKey(
                        blank=True,
                        default=None,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="reservations",
                        to="pms.space",
                    ),
                ),
            ],
        ),
    ]
