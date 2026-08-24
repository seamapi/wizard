"""Root URL config: everything lives under the pms app."""

from django.urls import include, path

urlpatterns = [
    path("", include("pms.urls")),
]
