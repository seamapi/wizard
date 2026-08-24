"""WSGI entry point.

Run with the Flask CLI (`flask --app wsgi run --port 8000`) or directly
(`python wsgi.py`). Both build the app through the application factory.
"""

from app import create_app

app = create_app()


if __name__ == "__main__":
    app.run(debug=True, port=8000)
