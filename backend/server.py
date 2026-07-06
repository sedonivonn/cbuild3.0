"""championsbuild backend entrypoint.

Modular FastAPI app with dual DB support (MongoDB / Firestore) and optional
Firebase Authentication. Env-driven; see backend/.env.example.
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, FastAPI
from starlette.middleware.cors import CORSMiddleware

from auth.router import router as auth_router
from config import settings
from db import close_db
from firebase_admin_init import (
    get_init_error,
    init_firebase,
    is_firebase_ready,
)
from routers.online import router as online_router
from routers.status import router as status_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(title="championsbuild-api", version="1.0.0")

# --- CORS ---
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=settings.cors_origins or ["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Startup: initialize Firebase (best-effort) ---
@app.on_event("startup")
async def on_startup() -> None:
    logger.info(
        "Starting championsbuild-api | env=%s db_provider=%s firebase_enabled=%s",
        settings.app_env,
        settings.db_provider,
        settings.firebase_enabled,
    )
    if settings.firebase_enabled:
        init_firebase()
        if not is_firebase_ready():
            logger.warning(
                "Firebase Admin failed to initialize: %s", get_init_error()
            )


@app.on_event("shutdown")
async def on_shutdown() -> None:
    await close_db()


# --- API router with /api prefix (required by Kubernetes ingress) ---
api_router = APIRouter(prefix="/api")
api_router.include_router(status_router)
api_router.include_router(auth_router)
api_router.include_router(online_router)


@api_router.get("/health")
async def health() -> dict:
    """Liveness + readiness endpoint used by Cloud Run."""
    return {
        "status": "ok",
        "env": settings.app_env,
        "db_provider": settings.db_provider,
        "firebase_enabled": settings.firebase_enabled,
        "firebase_ready": is_firebase_ready(),
    }


app.include_router(api_router)


@app.get("/")
async def index() -> dict:
    """Non-API root, useful when hitting the Cloud Run URL directly."""
    return {"service": "championsbuild-api", "docs": "/docs"}


# --- Socket.IO Yerel FastAPI Bağlantısı (Mount) -----------------
import socketio
from sio_server import sio

# socketio_path="" bırakıyoruz çünkü yönlendirmeyi zaten FastAPI üstlenecek
sio_asgi_app = socketio.ASGIApp(socketio_server=sio, socketio_path="")
app.mount("/api/socket.io", sio_asgi_app)


# --- MUTLAK ÇÖZÜM: En Dış Katman Çift CORS Temizleyici (ASGI) ---
class CleanCORSMiddleware:
    def __init__(self, inner_app):
        self.inner_app = inner_app

    async def __call__(self, scope, receive, send):
        # Sadece HTTP ve Polling el sıkışma isteklerini filtrele
        if scope["type"] != "http":
            await self.inner_app(scope, receive, send)
            return

        async def send_wrapper(message):
            if message["type"] == "http.response.start":
                headers = message.get("headers", [])
                new_headers = []
                origin_seen = False
                
                for key, value in headers:
                    if key.lower() == b"access-control-allow-origin":
                        if not origin_seen:
                            # Virgülle birleşmiş çift değerleri temizle
                            if b"," in value:
                                value = value.split(b",")[0].strip()
                            new_headers.append((key, value))
                            origin_seen = True
                        # İkinci kez eklenen CORS başlığı varsa pas geç, ekleme!
                    else:
                        new_headers.append((key, value))
                message["headers"] = new_headers
            await send(message)

        await self.inner_app(scope, receive, send_wrapper)

# Tüm uygulamayı bu zırhla kaplıyoruz
app = CleanCORSMiddleware(app)
