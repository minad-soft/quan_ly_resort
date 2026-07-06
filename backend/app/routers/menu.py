from fastapi import APIRouter, Depends, HTTPException, Query
from app.dependencies import get_current_user, require_roles
from app.database import get_supabase_admin
from typing import Optional
from pydantic import BaseModel

router = APIRouter(prefix="/api/menu", tags=["Menu"])

class MenuItemCreate(BaseModel):
    name: str
    category: str = "Khác"
    price: float = 0
    item_type: str = "goods"
    is_available: bool = True

class MenuItemUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    price: Optional[float] = None
    item_type: Optional[str] = None
    is_available: Optional[bool] = None

@router.post("")
async def create_menu_item(
    payload: MenuItemCreate,
    current_user: dict = Depends(require_roles("admin", "manager")),
):
    """Thêm mới sản phẩm/dịch vụ."""
    sb = get_supabase_admin()
    data = payload.model_dump()
    data["branch_id"] = current_user["branch_id"]
    result = sb.table("menu_items").insert(data).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Không thể tạo sản phẩm")
    return {"data": result.data[0], "message": "Thêm thành công"}

@router.put("/{item_id}")
async def update_menu_item(
    item_id: str,
    payload: MenuItemUpdate,
    current_user: dict = Depends(require_roles("admin", "manager")),
):
    """Cập nhật thông tin sản phẩm/dịch vụ."""
    sb = get_supabase_admin()
    update_data = {k: v for k, v in payload.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="Không có dữ liệu cập nhật")

    result = (
        sb.table("menu_items")
        .update(update_data)
        .eq("id", item_id)
        .eq("branch_id", current_user["branch_id"])
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Không tìm thấy mục")
    return {"data": result.data[0], "message": "Cập nhật thành công"}

@router.delete("/{item_id}")
async def delete_menu_item(
    item_id: str,
    current_user: dict = Depends(require_roles("admin", "manager")),
):
    """Xóa sản phẩm/dịch vụ."""
    sb = get_supabase_admin()
    result = (
        sb.table("menu_items")
        .delete()
        .eq("id", item_id)
        .eq("branch_id", current_user["branch_id"])
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Không tìm thấy mục")
    return {"message": "Xóa thành công"}


@router.get("")
async def list_menu_items(
    category: Optional[str] = Query(None),
    item_type: Optional[str] = Query(None),
    all_status: bool = Query(False, description="Nếu true, trả về cả sản phẩm ngừng bán"),
    current_user: dict = Depends(get_current_user),
):
    """Danh sách thực đơn theo chi nhánh."""
    sb = get_supabase_admin()
    query = (
        sb.table("menu_items")
        .select("*")
        .eq("branch_id", current_user["branch_id"])
        .order("sort_order")
        .order("category")
    )
    if not all_status:
        query = query.eq("is_available", True)
    if category:
        query = query.eq("category", category)
    if item_type:
        query = query.eq("item_type", item_type)

    result = query.execute()
    return {"data": result.data, "count": len(result.data)}


@router.put("/{item_id}/item-type")
async def update_menu_item_type(
    item_id: str,
    item_type: str = Query(..., description="'goods' or 'service'"),
    current_user: dict = Depends(require_roles("admin", "manager")),
):
    """Cập nhật phân loại hàng hóa/dịch vụ."""
    sb = get_supabase_admin()
    result = (
        sb.table("menu_items")
        .update({"item_type": item_type})
        .eq("id", item_id)
        .eq("branch_id", current_user["branch_id"])
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Không tìm thấy mục")
    return {"data": result.data[0], "message": "Cập nhật thành công"}
