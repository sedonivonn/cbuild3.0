"""championsbuild backend entrypoint.

Modular FastAPI app with dual DB support (MongoDB / Firestore) and optional
Firebase Authentication. Env-driven; see backend/.env.example.
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, FastAPI
from starlette.middleware.cors import CORSMiddleware as StarletteCORSMiddleware

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


# --- KESİN ÇÖZÜM: Yol Seçici (Selective) CORS Yönetimi ---
# Bu bağımsız katman, normal REST isteklerine standart CORS uygularken, 
# Socket.IO /api/socket.io isteklerini bu süzgeçten tamamen muaf tutar. 
# Böylece iki tarafın başlıkları birbirine asla karışamaz.

base_cors = StarletteCORSMiddleware(
    app=app,
    allow_origins=settings.cors_origins or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class SelectiveCORSMiddleware:
    def __init__(self, inner_app, cors_middleware):
        self.inner_app = inner_app
        self.cors_middleware = cors_middleware

    async def __call__(self, scope, receive, send):
        path = scope.get("path", "")
        if scope["type"] in ("http", "websocket") and path.startswith("/api/socket.io"):
            # İstek Socket.IO adresi ise CORS süzgecine uğramadan doğrudan uygulamaya gönder
            await self.inner_app(scope, receive, send)
        else:
            # Geri kalan tüm normal API isteklerini güvenli standart CORS süzgecine sok
            await self.cors_middleware(scope, receive, send)

# Ana uygulamayı bu akıllı seçici zırhla sarmalıyoruz
app = SelectiveCORSMiddleware(app, base_cors)
