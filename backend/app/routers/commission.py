"""
Router cho tính năng Gói vé & Hoa hồng tài xế.

Endpoints:
  - /api/commission/packages      : CRUD gói vé (combo includes)
  - /api/commission/settings      : CRUD cấu hình hoa hồng
  - /api/commission/tickets       : Quản lý phiếu chi hoa hồng
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from app.dependencies import get_current_user, require_roles
from app.database import get_supabase_admin
from app.schemas.commission import (
    PackageIncludeCreate,
    PackageIncludeUpdate,
    CommissionSettingCreate,
    CommissionSettingUpdate,
    CommissionTicketCreate,
    CommissionTicketPay,
)
from typing import Optional
from datetime import datetime, date

router = APIRouter(prefix="/api/commission", tags=["Commission"])


# ══════════════════════════════════════════════
# PACKAGE INCLUDES (Gói vé / Combo)
# ══════════════════════════════════════════════

@router.get("/packages/{menu_item_id}")
async def get_package_includes(
    menu_item_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Lấy danh sách item con trong một gói combo."""
    sb = get_supabase_admin()
    branch_id = current_user["branch_id"]

    result = (
        sb.table("package_includes")
        .select("*, child:menu_items!child_item_id(id, name, price, category)")
        .eq("branch_id", branch_id)
        .eq("parent_item_id", menu_item_id)
        .execute()
    )

    return {"data": result.data, "count": len(result.data)}


@router.post("/packages")
async def create_package_include(
    body: PackageIncludeCreate,
    current_user: dict = Depends(require_roles("admin", "manager")),
):
    """Thêm item con vào gói combo."""
    sb = get_supabase_admin()
    branch_id = current_user["branch_id"]

    # Không cho thêm chính nó
    if body.parent_item_id == body.child_item_id:
        raise HTTPException(
            status_code=400,
            detail="Không thể thêm chính mục đó vào gói",
        )

    # Kiểm tra trùng lặp
    existing = (
        sb.table("package_includes")
        .select("id")
        .eq("branch_id", branch_id)
        .eq("parent_item_id", body.parent_item_id)
        .eq("child_item_id", body.child_item_id)
        .maybe_single()
        .execute()
    )
    if existing.data:
        raise HTTPException(
            status_code=400,
            detail="Mục này đã có trong gói",
        )

    result = (
        sb.table("package_includes")
        .insert({
            "branch_id": branch_id,
            "parent_item_id": body.parent_item_id,
            "child_item_id": body.child_item_id,
            "quantity": body.quantity,
        })
        .execute()
    )

    return {"data": result.data[0], "message": "Thêm vào gói thành công"}


@router.put("/packages/{id}")
async def update_package_include(
    id: str,
    body: PackageIncludeUpdate,
    current_user: dict = Depends(require_roles("admin", "manager")),
):
    """Cập nhật số lượng item trong gói."""
    sb = get_supabase_admin()
    branch_id = current_user["branch_id"]

    update_data = body.model_dump(exclude_none=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="Không có dữ liệu cập nhật")

    result = (
        sb.table("package_includes")
        .update(update_data)
        .eq("id", id)
        .eq("branch_id", branch_id)
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=404, detail="Không tìm thấy mục trong gói")

    return {"data": result.data[0], "message": "Cập nhật thành công"}


@router.delete("/packages/{id}")
async def delete_package_include(
    id: str,
    current_user: dict = Depends(require_roles("admin", "manager")),
):
    """Xoá item khỏi gói combo."""
    sb = get_supabase_admin()
    branch_id = current_user["branch_id"]

    result = (
        sb.table("package_includes")
        .delete()
        .eq("id", id)
        .eq("branch_id", branch_id)
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=404, detail="Không tìm thấy mục trong gói")

    return {"message": "Đã xoá khỏi gói"}


# ══════════════════════════════════════════════
# COMMISSION SETTINGS (Cấu hình hoa hồng)
# ══════════════════════════════════════════════

@router.get("/settings")
async def list_commission_settings(
    current_user: dict = Depends(get_current_user),
):
    """Danh sách cấu hình hoa hồng theo chi nhánh."""
    sb = get_supabase_admin()
    branch_id = current_user["branch_id"]

    result = (
        sb.table("commission_settings")
        .select("*, menu_item:menu_items(id, name, price, category)")
        .eq("branch_id", branch_id)
        .order("created_at", desc=True)
        .execute()
    )

    return {"data": result.data, "count": len(result.data)}


@router.post("/settings")
async def create_commission_setting(
    body: CommissionSettingCreate,
    current_user: dict = Depends(require_roles("admin", "manager")),
):
    """Tạo hoặc cập nhật cấu hình hoa hồng (upsert theo menu_item_id)."""
    sb = get_supabase_admin()
    branch_id = current_user["branch_id"]

    # Validate commission_type
    if body.commission_type not in ("fixed", "percentage"):
        raise HTTPException(
            status_code=400,
            detail="commission_type phải là 'fixed' hoặc 'percentage'",
        )

    # Kiểm tra đã tồn tại chưa → upsert
    existing = (
        sb.table("commission_settings")
        .select("id")
        .eq("branch_id", branch_id)
        .eq("menu_item_id", body.menu_item_id)
        .maybe_single()
        .execute()
    )

    if existing.data:
        # Update existing setting
        result = (
            sb.table("commission_settings")
            .update({
                "commission_type": body.commission_type,
                "commission_value": body.commission_value,
                "is_active": True,
            })
            .eq("id", existing.data["id"])
            .execute()
        )
        return {"data": result.data[0], "message": "Cập nhật hoa hồng thành công"}

    # Insert new setting
    result = (
        sb.table("commission_settings")
        .insert({
            "branch_id": branch_id,
            "menu_item_id": body.menu_item_id,
            "commission_type": body.commission_type,
            "commission_value": body.commission_value,
        })
        .execute()
    )

    return {"data": result.data[0], "message": "Tạo cấu hình hoa hồng thành công"}


@router.put("/settings/{id}")
async def update_commission_setting(
    id: str,
    body: CommissionSettingUpdate,
    current_user: dict = Depends(require_roles("admin", "manager")),
):
    """Cập nhật cấu hình hoa hồng."""
    sb = get_supabase_admin()
    branch_id = current_user["branch_id"]

    update_data = body.model_dump(exclude_none=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="Không có dữ liệu cập nhật")

    # Validate commission_type nếu được truyền
    if "commission_type" in update_data and update_data["commission_type"] not in ("fixed", "percentage"):
        raise HTTPException(
            status_code=400,
            detail="commission_type phải là 'fixed' hoặc 'percentage'",
        )

    result = (
        sb.table("commission_settings")
        .update(update_data)
        .eq("id", id)
        .eq("branch_id", branch_id)
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=404, detail="Không tìm thấy cấu hình hoa hồng")

    return {"data": result.data[0], "message": "Cập nhật thành công"}


@router.delete("/settings/{id}")
async def delete_commission_setting(
    id: str,
    current_user: dict = Depends(require_roles("admin", "manager")),
):
    """Xoá cấu hình hoa hồng."""
    sb = get_supabase_admin()
    branch_id = current_user["branch_id"]

    result = (
        sb.table("commission_settings")
        .delete()
        .eq("id", id)
        .eq("branch_id", branch_id)
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=404, detail="Không tìm thấy cấu hình hoa hồng")

    return {"message": "Đã xoá cấu hình hoa hồng"}


# ══════════════════════════════════════════════
# COMMISSION TICKETS (Phiếu chi hoa hồng)
# ══════════════════════════════════════════════

@router.get("/tickets")
async def list_commission_tickets(
    status: Optional[str] = Query(None, description="Filter by status: pending, paid, cancelled"),
    date_str: Optional[str] = Query(None, alias="date", description="Filter by date (YYYY-MM-DD)"),
    current_user: dict = Depends(get_current_user),
):
    """Danh sách phiếu chi hoa hồng theo chi nhánh."""
    sb = get_supabase_admin()
    branch_id = current_user["branch_id"]

    query = (
        sb.table("commission_tickets")
        .select("*")
        .eq("branch_id", branch_id)
        .order("created_at", desc=True)
    )

    if status:
        query = query.eq("status", status)

    if date_str:
        # Lọc theo ngày: created_at >= date 00:00 AND < date+1 00:00
        query = query.gte("created_at", f"{date_str}T00:00:00")
        query = query.lt("created_at", f"{date_str}T23:59:59.999999")

    result = query.execute()

    return {"data": result.data, "count": len(result.data)}


@router.get("/tickets/scan/{code}")
async def scan_commission_ticket(
    code: str,
    current_user: dict = Depends(get_current_user),
):
    """Tra cứu phiếu chi hoa hồng theo mã code (quét barcode)."""
    sb = get_supabase_admin()
    branch_id = current_user["branch_id"]

    result = (
        sb.table("commission_tickets")
        .select("*")
        .eq("branch_id", branch_id)
        .eq("code", code)
        .maybe_single()
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=404, detail="Không tìm thấy phiếu hoa hồng")

    ticket = result.data

    # Kiểm tra phiếu có phải hôm nay không
    created_at = datetime.fromisoformat(ticket["created_at"].replace("Z", "+00:00"))
    today = date.today()
    if created_at.date() != today:
        raise HTTPException(
            status_code=400,
            detail=f"Phiếu đã hết hạn. Phiếu được tạo ngày {created_at.date()}, hôm nay là {today}",
        )

    return {"data": ticket}


@router.post("/tickets")
async def create_commission_ticket(
    body: CommissionTicketCreate,
    current_user: dict = Depends(get_current_user),
):
    """Tạo phiếu chi hoa hồng (khi thu ngân chọn hoa hồng tài xế)."""
    sb = get_supabase_admin()
    branch_id = current_user["branch_id"]

    # Sinh mã phiếu: HH-YYYYMMDD-XXXX
    today_str = date.today().strftime("%Y%m%d")
    prefix = f"HH-{today_str}"

    # Đếm phiếu trong ngày để sinh số thứ tự
    count_result = (
        sb.table("commission_tickets")
        .select("id", count="exact")
        .eq("branch_id", branch_id)
        .like("code", f"{prefix}%")
        .execute()
    )
    next_num = (count_result.count or 0) + 1
    code = f"{prefix}-{next_num:04d}"

    result = (
        sb.table("commission_tickets")
        .insert({
            "branch_id": branch_id,
            "code": code,
            "order_id": body.order_id,
            "menu_item_id": body.menu_item_id,
            "driver_name": body.driver_name,
            "driver_phone": body.driver_phone,
            "amount": body.amount,
            "status": "pending",
            "created_by": current_user["id"],
        })
        .execute()
    )

    return {"data": result.data[0], "message": f"Tạo phiếu hoa hồng {code} thành công"}


@router.post("/tickets/{id}/pay")
async def pay_commission_ticket(
    id: str,
    body: CommissionTicketPay,
    current_user: dict = Depends(get_current_user),
):
    """Thanh toán phiếu hoa hồng (thu ngân / kế toán)."""
    sb = get_supabase_admin()
    branch_id = current_user["branch_id"]

    # Lấy phiếu hiện tại
    ticket = (
        sb.table("commission_tickets")
        .select("*")
        .eq("id", id)
        .eq("branch_id", branch_id)
        .maybe_single()
        .execute()
    )

    if not ticket.data:
        raise HTTPException(status_code=404, detail="Không tìm thấy phiếu hoa hồng")

    # Kiểm tra trạng thái
    if ticket.data["status"] != "pending":
        raise HTTPException(
            status_code=400,
            detail=f"Phiếu ở trạng thái '{ticket.data['status']}', chỉ thanh toán được phiếu 'pending'",
        )

    # Kiểm tra phiếu phải được tạo trong ngày
    created_at = datetime.fromisoformat(ticket.data["created_at"].replace("Z", "+00:00"))
    today = date.today()
    if created_at.date() != today:
        raise HTTPException(
            status_code=400,
            detail=f"Phiếu đã hết hạn. Phiếu tạo ngày {created_at.date()}, chỉ thanh toán được trong ngày tạo",
        )

    # Validate payment_method
    if body.payment_method not in ("cash", "transfer"):
        raise HTTPException(
            status_code=400,
            detail="payment_method phải là 'cash' hoặc 'transfer'",
        )

    # Cập nhật phiếu
    result = (
        sb.table("commission_tickets")
        .update({
            "status": "paid",
            "payment_method": body.payment_method,
            "paid_at": datetime.utcnow().isoformat(),
            "paid_by": current_user["id"],
        })
        .eq("id", id)
        .eq("branch_id", branch_id)
        .execute()
    )

    return {"data": result.data[0], "message": "Thanh toán hoa hồng thành công"}


@router.post("/tickets/{id}/cancel")
async def cancel_commission_ticket(
    id: str,
    current_user: dict = Depends(require_roles("admin", "manager")),
):
    """Huỷ phiếu hoa hồng (chỉ admin/manager)."""
    sb = get_supabase_admin()
    branch_id = current_user["branch_id"]

    # Lấy phiếu hiện tại
    ticket = (
        sb.table("commission_tickets")
        .select("id, status")
        .eq("id", id)
        .eq("branch_id", branch_id)
        .maybe_single()
        .execute()
    )

    if not ticket.data:
        raise HTTPException(status_code=404, detail="Không tìm thấy phiếu hoa hồng")

    if ticket.data["status"] == "paid":
        raise HTTPException(
            status_code=400,
            detail="Không thể huỷ phiếu đã thanh toán",
        )

    if ticket.data["status"] == "cancelled":
        raise HTTPException(
            status_code=400,
            detail="Phiếu đã được huỷ trước đó",
        )

    result = (
        sb.table("commission_tickets")
        .update({"status": "cancelled"})
        .eq("id", id)
        .eq("branch_id", branch_id)
        .execute()
    )

    return {"data": result.data[0], "message": "Đã huỷ phiếu hoa hồng"}
