from fastapi import APIRouter, Depends, HTTPException, Query
from app.dependencies import get_current_user
from app.database import get_supabase_admin
from app.schemas.rooms import RoomResponse, RoomStatusUpdate
from typing import Optional

router = APIRouter(prefix="/api/rooms", tags=["Rooms"])


@router.get("")
async def list_rooms(
    status: Optional[str] = Query(None, description="Filter by status"),
    floor: Optional[int] = Query(None, description="Filter by floor"),
    current_user: dict = Depends(get_current_user),
):
    """Danh sách phòng theo chi nhánh, có filter."""
    sb = get_supabase_admin()
    query = (
        sb.table("rooms")
        .select("*, room_types(*)")
        .eq("branch_id", current_user["branch_id"])
        .order("room_number")
    )

    if status:
        query = query.eq("status", status)
    if floor is not None:
        query = query.eq("floor", floor)

    result = query.execute()
    return {"data": result.data, "count": len(result.data)}


@router.get("/{room_id}")
async def get_room(
    room_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Chi tiết phòng."""
    sb = get_supabase_admin()
    result = (
        sb.table("rooms")
        .select("*, room_types(*)")
        .eq("id", room_id)
        .eq("branch_id", current_user["branch_id"])
        .single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Room not found")
    return {"data": result.data}


@router.patch("/{room_id}/status")
async def update_room_status(
    room_id: str,
    body: RoomStatusUpdate,
    current_user: dict = Depends(get_current_user),
):
    """Cập nhật trạng thái phòng (VD: cleaning → available)."""
    valid_statuses = ["available", "occupied", "cleaning", "maintenance", "out_of_service"]
    if body.status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")

    sb = get_supabase_admin()
    result = (
        sb.table("rooms")
        .update({"status": body.status})
        .eq("id", room_id)
        .eq("branch_id", current_user["branch_id"])
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Room not found")
    return {"data": result.data[0], "message": f"Room status updated to '{body.status}'"}
