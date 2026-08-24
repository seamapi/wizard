"""Django settings for the PMS fixture.

Minimal but runnable. Reads SEAM_API_KEY and DJANGO_SECRET_KEY from the
environment (optionally via a local .env), so nothing secret is committed.
"""

import os
from pathlib import Path

from dotenv import load_dotenv

# Load .env so SEAM_API_KEY (and anything else) is available via os.environ.
load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent

# Never hardcode a real secret. The fallback is an obviously-fake dev-only value,
# matching what `django-admin startproject` generates; override in real deploys.
SECRET_KEY = os.environ.get(
    "DJANGO_SECRET_KEY", "django-insecure-dev-only-do-not-use-in-production"
)

# The Seam API key the integration code will use. Read here so it is available
# app-wide via `from django.conf import settings; settings.SEAM_API_KEY`.
SEAM_API_KEY = os.environ.get("SEAM_API_KEY", "")

DEBUG = os.environ.get("DJANGO_DEBUG", "true").lower() == "true"

ALLOWED_HOSTS = ["*"]

INSTALLED_APPS = [
    "django.contrib.contenttypes",
    "django.contrib.staticfiles",
    "pms",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        # APP_DIRS finds pms/templates/pms/*.html automatically.
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

# SQLite by default; the db.sqlite3 file is created by `python manage.py migrate`.
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",
    }
}

STATIC_URL = "static/"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
