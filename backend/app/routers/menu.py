from fastapi import APIRouter, Depends, Query
from app.dependencies import get_current_user
from app.database import get_supabase_admin
from typing import Optional

router = APIRouter(prefix="/api/menu", tags=["Menu"])


@router.get("")
async def list_menu_items(
    category: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
):
    """Danh sách thực đơn theo chi nhánh."""
    sb = get_supabase_admin()
    query = (
        sb.table("menu_items")
        .select("*")
        .eq("branch_id", current_user["branch_id"])
        .eq("is_available", True)
        .order("sort_order")
        .order("category")
    )
    if category:
        query = query.eq("category", category)

    result = query.execute()
    return {"data": result.data, "count": len(result.data)}
