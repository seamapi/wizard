"""The Flask-SQLAlchemy extension instance and declarative base.

`db` is created here (unbound) and wired to the app in `create_app` via
`db.init_app(app)`, which keeps the application-factory pattern importable
without a live app context.
"""

from sqlalchemy.orm import DeclarativeBase

from flask_sqlalchemy import SQLAlchemy


class Base(DeclarativeBase):
    pass


db = SQLAlchemy(model_class=Base)
