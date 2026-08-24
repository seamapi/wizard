"""URL routes for the PMS app."""

from django.urls import path

from pms import views

urlpatterns = [
    # Public booking flow.
    path("", views.home, name="home"),
    path("book", views.book, name="book"),
    # Front desk.
    path("reservations", views.reservations_page, name="reservations"),
    path("guests", views.guests_page, name="guests"),
    path(
        "reservations/<int:reservation_id>/status",
        views.update_status,
        name="reservation_status",
    ),
    path(
        "reservations/<int:reservation_id>/assign",
        views.assign_space,
        name="reservation_assign",
    ),
    path(
        "reservations/<int:reservation_id>/delete",
        views.delete_reservation,
        name="reservation_delete",
    ),
    # Space inventory.
    path("spaces", views.spaces_page, name="spaces"),
    path("spaces/create", views.create_space, name="space_create"),
    path("spaces/<int:space_id>/update", views.update_space, name="space_update"),
    path("spaces/<int:space_id>/status", views.set_space_status, name="space_status"),
]
