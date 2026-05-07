from app.database import get_supabase_admin
from fastapi import HTTPException


async def deduct_bom_for_order(
    order_id: str,
    branch_id: str,
    items: list[dict],
    created_by: str,
):
    """
    Trừ kho tự động theo BOM khi tạo order.

    1. Lấy BOM recipes cho mỗi menu_item
    2. Tính tổng nguyên liệu cần trừ
    3. Kiểm tra tồn kho đủ không
    4. Trừ quantity_on_hand
    5. Ghi log inventory_transactions
    """
    sb = get_supabase_admin()

    # Collect all menu_item_ids
    menu_item_ids = [item["menu_item_id"] for item in items]

    # Get BOM recipes for all items
    bom_result = (
        sb.table("bom_recipes")
        .select("menu_item_id, inventory_item_id, quantity_needed, unit")
        .in_("menu_item_id", menu_item_ids)
        .execute()
    )

    if not bom_result.data:
        # No BOM recipes = no inventory deduction needed (e.g., services)
        return

    # Build deduction map: {inventory_item_id: total_quantity_to_deduct}
    deductions: dict[str, float] = {}
    for item in items:
        order_qty = item["quantity"]
        for recipe in bom_result.data:
            if recipe["menu_item_id"] == item["menu_item_id"]:
                inv_id = recipe["inventory_item_id"]
                needed = recipe["quantity_needed"] * order_qty
                deductions[inv_id] = deductions.get(inv_id, 0) + needed

    if not deductions:
        return

    # Get current stock levels
    inv_ids = list(deductions.keys())
    stock_result = (
        sb.table("inventory_items")
        .select("id, name, quantity_on_hand, unit")
        .in_("id", inv_ids)
        .eq("branch_id", branch_id)
        .execute()
    )

    stock_map = {item["id"]: item for item in stock_result.data}

    # Check sufficient stock
    insufficient = []
    for inv_id, needed in deductions.items():
        stock = stock_map.get(inv_id)
        if not stock:
            insufficient.append(f"Unknown item {inv_id}")
        elif stock["quantity_on_hand"] < needed:
            insufficient.append(
                f"{stock['name']}: cần {needed} {stock['unit']}, "
                f"tồn kho {stock['quantity_on_hand']} {stock['unit']}"
            )

    if insufficient:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "Không đủ nguyên liệu trong kho",
                "items": insufficient,
            },
        )

    # Deduct stock and create transaction logs
    for inv_id, needed in deductions.items():
        stock = stock_map[inv_id]
        new_balance = stock["quantity_on_hand"] - needed

        # Update inventory
        sb.table("inventory_items").update(
            {"quantity_on_hand": new_balance}
        ).eq("id", inv_id).execute()

        # Log transaction
        sb.table("inventory_transactions").insert({
            "branch_id": branch_id,
            "inventory_item_id": inv_id,
            "transaction_type": "bom_deduction",
            "quantity": -needed,
            "balance_after": new_balance,
            "reference_type": "order",
            "reference_id": order_id,
            "notes": f"BOM auto-deduction for order",
            "created_by": created_by,
        }).execute()
