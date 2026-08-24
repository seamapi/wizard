"""The shared Jinja2 templates instance, imported by every router and by main."""

from pathlib import Path

from fastapi.templating import Jinja2Templates

from app.space_kinds import SPACE_KIND_LABELS

TEMPLATES_DIR = Path(__file__).resolve().parent.parent / "templates"

templates = Jinja2Templates(directory=str(TEMPLATES_DIR))
# Expose the space-kind labels to every template so they render consistently.
templates.env.globals["SPACE_KIND_LABELS"] = SPACE_KIND_LABELS
