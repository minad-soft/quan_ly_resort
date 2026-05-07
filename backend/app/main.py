from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import get_settings
from app.routers import rooms, bookings, orders, menu, webhooks, inventory, attendance, payroll, shifts, housekeeping, dashboard
from app.routers import settings as settings_router

settings = get_settings()

app = FastAPI(
    title="ROM - Resort Operations Manager",
    description="API quản lý vận hành resort đa chi nhánh",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(rooms.router)
app.include_router(bookings.router)
app.include_router(orders.router)
app.include_router(menu.router)
app.include_router(webhooks.router)
app.include_router(inventory.router)
app.include_router(attendance.router)
app.include_router(payroll.router)
app.include_router(shifts.router)
app.include_router(housekeeping.router)
app.include_router(dashboard.router)
app.include_router(settings_router.router)


@app.get("/", tags=["Health"])
async def health_check():
    return {
        "status": "ok",
        "app": "ROM Resort Operations Manager",
        "version": "1.0.0",
    }
