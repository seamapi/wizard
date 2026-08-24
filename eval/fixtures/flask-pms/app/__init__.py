"""Flask PMS application factory.

`create_app()` builds and configures the app: it loads `.env` (so `SEAM_API_KEY`
and friends are on `os.environ`), wires up Flask-SQLAlchemy, creates the tables
on first run, and registers one blueprint per area of the app.
"""

import os

from dotenv import load_dotenv
from flask import Flask

from app.db import db
from app.routers import bookings, reservations, spaces
from app.space_kinds import SPACE_KIND_LABELS

# Obviously-fake fallback so `flask run` works out of the box in local dev.
# Set FLASK_SECRET_KEY in the environment for anything that isn't local dev.
_DEV_ONLY_SECRET_KEY = "dev-only-insecure-do-not-use-in-production"


def create_app() -> Flask:
    load_dotenv()

    app = Flask(__name__)
    app.config["SECRET_KEY"] = os.environ.get("FLASK_SECRET_KEY", _DEV_ONLY_SECRET_KEY)
    app.config["SQLALCHEMY_DATABASE_URI"] = os.environ.get(
        "DATABASE_URL", "sqlite:///pms.db"
    )
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    db.init_app(app)

    # Import the models so their tables are registered on the metadata before
    # create_all runs.
    import app.models  # noqa: F401

    with app.app_context():
        db.create_all()

    # Expose the space-kind labels to every template so they render consistently.
    app.jinja_env.globals["SPACE_KIND_LABELS"] = SPACE_KIND_LABELS

    app.register_blueprint(bookings.bp)
    app.register_blueprint(reservations.bp)
    app.register_blueprint(spaces.bp)

    return app
