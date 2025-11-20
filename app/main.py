from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.staticfiles import StaticFiles
from .routers import datasets

app = FastAPI(title="CSV Auto Preprocess & Visualize")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(datasets.router, prefix="/api", tags=["datasets"])

# Serve the frontend (static files)
app.mount("/", StaticFiles(directory="frontend", html=True), name="frontend")
