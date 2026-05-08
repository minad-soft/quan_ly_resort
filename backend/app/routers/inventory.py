from fastapi import APIRouter, Depends, HTTPException, Query
from app.dependencies import get_current_user, require_roles
from app.database import get_supabase_admin
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/api/inventory", tags=["Inventory"])


class StockAdjust(BaseModel):
    inventory_item_id: str
    quantity: float  # positive = stock in, negative = stock out
    transaction_type: str = "stock_in"  # stock_in, stock_out, adjustment
    notes: Optional[str] = None


@router.get("")
async def list_inventory(
    category: Optional[str] = Query(None),
    low_stock: Optional[bool] = Query(None, description="Only show items below min stock"),
    current_user: dict = Depends(get_current_user),
):
    """Danh sách tồn kho."""
    sb = get_supabase_admin()
    query = (
        sb.table("inventory_items")
        .select("*")
        .eq("branch_id", current_user["branch_id"])
        .eq("is_active", True)
        .order("category")
        .order("name")
    )
    if category:
        query = query.eq("category", category)

    result = query.execute()
    items = result.data

    if low_stock:
        items = [i for i in items if i["quantity_on_hand"] <= i["min_stock_level"]]

    return {"data": items, "count": len(items)}


@router.post("/adjust")
async def adjust_stock(
    body: StockAdjust,
    current_user: dict = Depends(require_roles("admin", "manager", "kitchen")),
):
    """Nhập/Xuất kho thủ công."""
    sb = get_supabase_admin()
    branch_id = current_user["branch_id"]

    # Get current stock
    item = (
        sb.table("inventory_items")
        .select("id, name, quantity_on_hand, unit")
        .eq("id", body.inventory_item_id)
        .eq("branch_id", branch_id)
        .maybe_single()
        .execute()
    )
    if not item.data:
        raise HTTPException(status_code=404, detail="Inventory item not found")

    new_balance = item.data["quantity_on_hand"] + body.quantity
    if new_balance < 0:
        raise HTTPException(status_code=400, detail="Insufficient stock")

    # Update stock
    sb.table("inventory_items").update(
        {"quantity_on_hand": new_balance}
    ).eq("id", body.inventory_item_id).execute()

    # Log transaction
    sb.table("inventory_transactions").insert({
        "branch_id": branch_id,
        "inventory_item_id": body.inventory_item_id,
        "transaction_type": body.transaction_type,
        "quantity": body.quantity,
        "balance_after": new_balance,
        "reference_type": "manual",
        "notes": body.notes,
        "created_by": current_user["id"],
    }).execute()

    return {
        "message": f"Stock adjusted: {item.data['name']} = {new_balance} {item.data['unit']}",
        "new_balance": new_balance,
    }
