from fastapi import APIRouter, Depends, HTTPException, Query
from app.dependencies import get_current_user, require_roles
from app.database import get_supabase_admin
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/api/shifts", tags=["Shifts"])


class ShiftCreate(BaseModel):
    name: str
    start_time: str  # HH:MM
    end_time: str    # HH:MM


class ShiftUpdate(BaseModel):
    name: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    is_active: Optional[bool] = None


@router.get("")
async def list_shifts(
    search: Optional[str] = Query(None, description="Tìm theo tên ca"),
    is_active: Optional[bool] = Query(None),
    current_user: dict = Depends(get_current_user),
):
    """Danh sách ca làm việc theo chi nhánh."""
    sb = get_supabase_admin()
    query = (
        sb.table("shifts")
        .select("*")
        .eq("branch_id", current_user["branch_id"])
        .order("start_time", desc=False)
    )
    if search:
        query = query.ilike("name", f"%{search}%")
    if is_active is not None:
        query = query.eq("is_active", is_active)

    result = query.execute()
    return {"data": result.data, "count": len(result.data)}


@router.get("/{shift_id}")
async def get_shift(
    shift_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Chi tiết một ca làm việc."""
    sb = get_supabase_admin()
    result = (
        sb.table("shifts")
        .select("*")
        .eq("id", shift_id)
        .eq("branch_id", current_user["branch_id"])
        .single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Ca làm việc không tồn tại")
    return {"data": result.data}


@router.post("")
async def create_shift(
    body: ShiftCreate,
    current_user: dict = Depends(require_roles("admin", "manager")),
):
    """Tạo ca làm việc mới."""
    sb = get_supabase_admin()
    record = {
        "branch_id": current_user["branch_id"],
        "name": body.name,
        "start_time": body.start_time,
        "end_time": body.end_time,
    }
    result = sb.table("shifts").insert(record).execute()
    return {"data": result.data[0], "message": "Tạo ca làm việc thành công"}


@router.patch("/{shift_id}")
async def update_shift(
    shift_id: str,
    body: ShiftUpdate,
    current_user: dict = Depends(require_roles("admin", "manager")),
):
    """Cập nhật ca làm việc."""
    sb = get_supabase_admin()

    # Kiểm tra tồn tại
    existing = (
        sb.table("shifts")
        .select("id")
        .eq("id", shift_id)
        .eq("branch_id", current_user["branch_id"])
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="Ca làm việc không tồn tại")

    update_data = body.model_dump(exclude_none=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="Không có dữ liệu cập nhật")

    result = (
        sb.table("shifts")
        .update(update_data)
        .eq("id", shift_id)
        .execute()
    )
    return {"data": result.data[0], "message": "Cập nhật ca làm việc thành công"}


@router.delete("/{shift_id}")
async def delete_shift(
    shift_id: str,
    current_user: dict = Depends(require_roles("admin", "manager")),
):
    """Xóa ca làm việc."""
    sb = get_supabase_admin()
    result = (
        sb.table("shifts")
        .delete()
        .eq("id", shift_id)
        .eq("branch_id", current_user["branch_id"])
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Ca làm việc không tồn tại")
    return {"message": "Xóa ca làm việc thành công"}
