"""FastAPI PMS entry point: create the app, its tables, and mount the routers."""

from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.db import Base, engine
from app.routers import bookings, reservations, spaces

# Import the models so their tables are registered on Base before create_all.
import app.models  # noqa: F401


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title="FastAPI PMS", lifespan=lifespan)

app.include_router(bookings.router)
app.include_router(reservations.router)
app.include_router(spaces.router)
