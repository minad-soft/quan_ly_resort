from fastapi import APIRouter, Depends, HTTPException, Query
from app.dependencies import get_current_user, require_roles
from app.database import get_supabase_admin
from pydantic import BaseModel
from typing import Optional, List

router = APIRouter(prefix="/api/room-settings", tags=["Room Settings"])


# =============================================
# Schemas
# =============================================

class RoomTypeCreate(BaseModel):
    name: str
    description: Optional[str] = None
    base_price: float = 0
    max_occupancy: int = 2
    amenities: Optional[List[str]] = []
    image_url: Optional[str] = None
    is_active: bool = True


class RoomTypeUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    base_price: Optional[float] = None
    max_occupancy: Optional[int] = None
    amenities: Optional[List[str]] = None
    image_url: Optional[str] = None
    is_active: Optional[bool] = None


class RoomCreate(BaseModel):
    room_number: str
    room_type_id: Optional[str] = None
    floor: Optional[int] = None
    notes: Optional[str] = None


class RoomUpdate(BaseModel):
    room_number: Optional[str] = None
    room_type_id: Optional[str] = None
    floor: Optional[int] = None
    notes: Optional[str] = None
    status: Optional[str] = None


# =============================================
# Room Types
# =============================================

@router.get("/room-types")
async def list_room_types(
    current_user: dict = Depends(get_current_user),
):
    """Danh sách loại phòng."""
    sb = get_supabase_admin()
    result = (
        sb.table("room_types")
        .select("*")
        .eq("branch_id", current_user["branch_id"])
        .order("name")
        .execute()
    )
    return {"data": result.data or []}


@router.post("/room-types")
async def create_room_type(
    payload: RoomTypeCreate,
    current_user: dict = Depends(require_roles("admin", "manager")),
):
    """Tạo loại phòng mới."""
    sb = get_supabase_admin()
    data = payload.model_dump()
    data["branch_id"] = current_user["branch_id"]

    result = sb.table("room_types").insert(data).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Không thể tạo loại phòng")
    return {"data": result.data[0], "message": "Tạo loại phòng thành công"}


@router.put("/room-types/{type_id}")
async def update_room_type(
    type_id: str,
    payload: RoomTypeUpdate,
    current_user: dict = Depends(require_roles("admin", "manager")),
):
    """Cập nhật loại phòng."""
    sb = get_supabase_admin()
    update_data = payload.model_dump(exclude_none=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="Không có dữ liệu cập nhật")

    result = (
        sb.table("room_types")
        .update(update_data)
        .eq("id", type_id)
        .eq("branch_id", current_user["branch_id"])
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Loại phòng không tồn tại")
    return {"data": result.data[0], "message": "Cập nhật thành công"}


@router.delete("/room-types/{type_id}")
async def delete_room_type(
    type_id: str,
    current_user: dict = Depends(require_roles("admin")),
):
    """Xóa loại phòng (chỉ khi không có phòng nào đang dùng)."""
    sb = get_supabase_admin()

    # Kiểm tra có phòng nào đang dùng loại phòng này không
    rooms_using = (
        sb.table("rooms")
        .select("id")
        .eq("room_type_id", type_id)
        .eq("branch_id", current_user["branch_id"])
        .execute()
    )
    if rooms_using.data:
        raise HTTPException(
            status_code=400,
            detail=f"Không thể xóa: có {len(rooms_using.data)} phòng đang dùng loại phòng này"
        )

    sb.table("room_types").delete().eq("id", type_id).eq("branch_id", current_user["branch_id"]).execute()
    return {"message": "Đã xóa loại phòng"}


# =============================================
# Rooms Management
# =============================================

@router.get("/rooms")
async def list_all_rooms(
    current_user: dict = Depends(require_roles("admin", "manager")),
):
    """Danh sách tất cả phòng (để quản lý)."""
    sb = get_supabase_admin()
    result = (
        sb.table("rooms")
        .select("*, room_types(id, name, base_price)")
        .eq("branch_id", current_user["branch_id"])
        .order("room_number")
        .execute()
    )
    return {"data": result.data or []}


@router.post("/rooms")
async def create_room(
    payload: RoomCreate,
    current_user: dict = Depends(require_roles("admin", "manager")),
):
    """Thêm phòng mới."""
    sb = get_supabase_admin()

    # Kiểm tra số phòng đã tồn tại chưa
    existing = (
        sb.table("rooms")
        .select("id")
        .eq("room_number", payload.room_number)
        .eq("branch_id", current_user["branch_id"])
        .execute()
    )
    if existing.data:
        raise HTTPException(status_code=400, detail=f"Số phòng '{payload.room_number}' đã tồn tại")

    data = payload.model_dump(exclude_none=True)
    data["branch_id"] = current_user["branch_id"]
    data["status"] = "available"

    result = sb.table("rooms").insert(data).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Không thể tạo phòng")
    return {"data": result.data[0], "message": "Thêm phòng thành công"}


@router.put("/rooms/{room_id}")
async def update_room(
    room_id: str,
    payload: RoomUpdate,
    current_user: dict = Depends(require_roles("admin", "manager")),
):
    """Cập nhật thông tin phòng."""
    sb = get_supabase_admin()
    update_data = payload.model_dump(exclude_none=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="Không có dữ liệu cập nhật")

    result = (
        sb.table("rooms")
        .update(update_data)
        .eq("id", room_id)
        .eq("branch_id", current_user["branch_id"])
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Phòng không tồn tại")
    return {"data": result.data[0], "message": "Cập nhật phòng thành công"}


@router.delete("/rooms/{room_id}")
async def delete_room(
    room_id: str,
    current_user: dict = Depends(require_roles("admin")),
):
    """Xóa phòng (chỉ khi không có booking đang active)."""
    sb = get_supabase_admin()

    # Kiểm tra có booking active không
    active_bookings = (
        sb.table("bookings")
        .select("id")
        .eq("room_id", room_id)
        .in_("status", ["confirmed", "checked_in"])
        .execute()
    )
    if active_bookings.data:
        raise HTTPException(
            status_code=400,
            detail="Không thể xóa phòng đang có khách hoặc đặt phòng"
        )

    sb.table("rooms").delete().eq("id", room_id).eq("branch_id", current_user["branch_id"]).execute()
    return {"message": "Đã xóa phòng"}
