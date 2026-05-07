from fastapi import APIRouter, Depends, HTTPException, Query
from app.dependencies import get_current_user, require_roles
from app.database import get_supabase_admin
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

router = APIRouter(prefix="/api/housekeeping", tags=["Housekeeping"])


class HousekeepingUpdate(BaseModel):
    status: str  # cleaning, available, maintenance
    notes: Optional[str] = None


class HousekeepingTask(BaseModel):
    room_id: str
    task_type: str  # checkout_clean, stay_clean, deep_clean, maintenance
    priority: str = "normal"  # low, normal, high, urgent
    notes: Optional[str] = None


@router.get("/rooms")
async def housekeeping_rooms(
    status: Optional[str] = Query(None, description="Filter: cleaning, maintenance, occupied"),
    floor: Optional[int] = Query(None),
    current_user: dict = Depends(get_current_user),
):
    """Danh sách phòng cho buồng phòng – ưu tiên phòng cần dọn."""
    sb = get_supabase_admin()
    branch_id = current_user["branch_id"]

    query = (
        sb.table("rooms")
        .select("*, room_types(name)")
        .eq("branch_id", branch_id)
        .order("floor", desc=False)
        .order("room_number", desc=False)
    )

    if status:
        query = query.eq("status", status)
    if floor is not None:
        query = query.eq("floor", floor)

    result = query.execute()

    # Ưu tiên: cleaning > maintenance > occupied > available > out_of_service
    priority_order = {
        "cleaning": 0,
        "maintenance": 1,
        "occupied": 2,
        "available": 3,
        "out_of_service": 4,
    }
    sorted_rooms = sorted(
        result.data,
        key=lambda r: priority_order.get(r.get("status", ""), 5)
    )

    # Tính thống kê
    stats = {
        "total": len(sorted_rooms),
        "cleaning": len([r for r in sorted_rooms if r["status"] == "cleaning"]),
        "maintenance": len([r for r in sorted_rooms if r["status"] == "maintenance"]),
        "available": len([r for r in sorted_rooms if r["status"] == "available"]),
        "occupied": len([r for r in sorted_rooms if r["status"] == "occupied"]),
    }

    return {"data": sorted_rooms, "stats": stats}


@router.patch("/rooms/{room_id}/status")
async def update_housekeeping_status(
    room_id: str,
    body: HousekeepingUpdate,
    current_user: dict = Depends(get_current_user),
):
    """Cập nhật trạng thái phòng từ nhân viên buồng phòng."""
    valid_statuses = ["available", "cleaning", "maintenance"]
    if body.status not in valid_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Trạng thái không hợp lệ. Cho phép: {valid_statuses}"
        )

    sb = get_supabase_admin()
    branch_id = current_user["branch_id"]

    # Kiểm tra phòng tồn tại
    existing = (
        sb.table("rooms")
        .select("id, room_number, status")
        .eq("id", room_id)
        .eq("branch_id", branch_id)
        .single()
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="Phòng không tồn tại")

    old_status = existing.data["status"]
    update_data = {"status": body.status}
    if body.notes is not None:
        update_data["notes"] = body.notes

    result = (
        sb.table("rooms")
        .update(update_data)
        .eq("id", room_id)
        .execute()
    )

    return {
        "data": result.data[0],
        "message": f"Phòng {existing.data['room_number']}: {old_status} → {body.status}",
    }


@router.get("/summary")
async def housekeeping_summary(
    current_user: dict = Depends(get_current_user),
):
    """Tổng quan buồng phòng – dành cho quản lý."""
    sb = get_supabase_admin()
    branch_id = current_user["branch_id"]

    rooms = (
        sb.table("rooms")
        .select("id, room_number, floor, status, room_types(name)")
        .eq("branch_id", branch_id)
        .execute()
    )

    data = rooms.data
    summary = {
        "total_rooms": len(data),
        "available": len([r for r in data if r["status"] == "available"]),
        "occupied": len([r for r in data if r["status"] == "occupied"]),
        "cleaning": len([r for r in data if r["status"] == "cleaning"]),
        "maintenance": len([r for r in data if r["status"] == "maintenance"]),
        "out_of_service": len([r for r in data if r["status"] == "out_of_service"]),
        "floors": sorted(set(r.get("floor", 0) for r in data)),
    }

    # Danh sách phòng cần chú ý (cleaning + maintenance)
    attention_rooms = [
        r for r in data if r["status"] in ("cleaning", "maintenance")
    ]

    return {"summary": summary, "attention_rooms": attention_rooms}
