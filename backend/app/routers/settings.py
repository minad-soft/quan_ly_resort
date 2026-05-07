from fastapi import APIRouter, Depends, HTTPException
from app.dependencies import get_current_user, require_roles
from app.database import get_supabase_admin
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/api/settings", tags=["Settings"])


# =============================================
# Schemas
# =============================================

class BranchUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    settings: Optional[dict] = None


class BankAccountCreate(BaseModel):
    bank_name: str
    bank_code: Optional[str] = None
    account_number: str
    account_holder: str
    is_primary: bool = False
    is_active: bool = True
    sepay_api_key: Optional[str] = None
    sepay_webhook_secret: Optional[str] = None


class BankAccountUpdate(BaseModel):
    bank_name: Optional[str] = None
    bank_code: Optional[str] = None
    account_number: Optional[str] = None
    account_holder: Optional[str] = None
    is_primary: Optional[bool] = None
    is_active: Optional[bool] = None
    sepay_api_key: Optional[str] = None
    sepay_webhook_secret: Optional[str] = None


# =============================================
# Branch Info
# =============================================

@router.get("/branch")
async def get_branch_info(
    current_user: dict = Depends(get_current_user),
):
    """Lấy thông tin chi nhánh hiện tại của user."""
    sb = get_supabase_admin()
    branch_id = current_user["branch_id"]

    result = sb.table("branches").select("*").eq("id", branch_id).single().execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Chi nhánh không tồn tại")

    return {"data": result.data}


@router.put("/branch")
async def update_branch_info(
    payload: BranchUpdate,
    current_user: dict = Depends(require_roles("admin", "manager")),
):
    """Cập nhật thông tin chi nhánh (chỉ admin/manager)."""
    sb = get_supabase_admin()
    branch_id = current_user["branch_id"]

    update_data = payload.model_dump(exclude_none=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="Không có dữ liệu để cập nhật")

    result = (
        sb.table("branches")
        .update(update_data)
        .eq("id", branch_id)
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=404, detail="Không tìm thấy chi nhánh")

    return {"data": result.data[0], "message": "Cập nhật thành công"}


# =============================================
# Bank Accounts
# =============================================

@router.get("/bank-accounts")
async def get_bank_accounts(
    current_user: dict = Depends(require_roles("admin", "manager")),
):
    """Lấy danh sách tài khoản ngân hàng của chi nhánh."""
    sb = get_supabase_admin()
    branch_id = current_user["branch_id"]

    result = (
        sb.table("branch_bank_accounts")
        .select("*")
        .eq("branch_id", branch_id)
        .order("is_primary", desc=True)
        .order("created_at", desc=True)
        .execute()
    )

    return {"data": result.data or []}


@router.post("/bank-accounts")
async def create_bank_account(
    payload: BankAccountCreate,
    current_user: dict = Depends(require_roles("admin", "manager")),
):
    """Thêm tài khoản ngân hàng mới."""
    sb = get_supabase_admin()
    branch_id = current_user["branch_id"]

    insert_data = payload.model_dump()
    insert_data["branch_id"] = branch_id

    # Nếu đánh dấu là primary, bỏ primary cũ
    if payload.is_primary:
        sb.table("branch_bank_accounts").update(
            {"is_primary": False}
        ).eq("branch_id", branch_id).execute()

    result = sb.table("branch_bank_accounts").insert(insert_data).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Không thể tạo tài khoản ngân hàng")

    return {"data": result.data[0], "message": "Thêm tài khoản thành công"}


@router.put("/bank-accounts/{account_id}")
async def update_bank_account(
    account_id: str,
    payload: BankAccountUpdate,
    current_user: dict = Depends(require_roles("admin", "manager")),
):
    """Cập nhật tài khoản ngân hàng."""
    sb = get_supabase_admin()
    branch_id = current_user["branch_id"]

    update_data = payload.model_dump(exclude_none=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="Không có dữ liệu để cập nhật")

    # Nếu đánh dấu là primary, bỏ primary cũ
    if payload.is_primary:
        sb.table("branch_bank_accounts").update(
            {"is_primary": False}
        ).eq("branch_id", branch_id).execute()

    result = (
        sb.table("branch_bank_accounts")
        .update(update_data)
        .eq("id", account_id)
        .eq("branch_id", branch_id)
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=404, detail="Không tìm thấy tài khoản")

    return {"data": result.data[0], "message": "Cập nhật thành công"}


@router.delete("/bank-accounts/{account_id}")
async def delete_bank_account(
    account_id: str,
    current_user: dict = Depends(require_roles("admin", "manager")),
):
    """Xóa tài khoản ngân hàng."""
    sb = get_supabase_admin()
    branch_id = current_user["branch_id"]

    result = (
        sb.table("branch_bank_accounts")
        .delete()
        .eq("id", account_id)
        .eq("branch_id", branch_id)
        .execute()
    )

    return {"message": "Đã xóa tài khoản ngân hàng"}
