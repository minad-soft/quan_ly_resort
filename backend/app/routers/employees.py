from fastapi import APIRouter, Depends, HTTPException, Query
from app.dependencies import get_current_user, require_roles
from app.database import get_supabase_admin
from pydantic import BaseModel
from typing import Optional, List

router = APIRouter(prefix="/api/employees", tags=["Employees"])


# =============================================
# Schemas
# =============================================

class EmployeeCreate(BaseModel):
    full_name: str
    email: str
    password: str
    role: str = "receptionist"
    phone: Optional[str] = None
    avatar_url: Optional[str] = None


class EmployeeUpdate(BaseModel):
    full_name: Optional[str] = None
    role: Optional[str] = None
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    is_active: Optional[bool] = None


VALID_ROLES = ["admin", "manager", "receptionist", "housekeeping", "kitchen", "cashier"]


# =============================================
# Endpoints
# =============================================

@router.get("")
async def list_employees(
    role: Optional[str] = Query(None),
    is_active: Optional[bool] = Query(None),
    search: Optional[str] = Query(None),
    current_user: dict = Depends(require_roles("admin", "manager")),
):
    """Danh sách nhân viên trong chi nhánh."""
    sb = get_supabase_admin()
    branch_id = current_user["branch_id"]

    query = (
        sb.table("users")
        .select("id, full_name, email, phone, role, avatar_url, is_active, created_at")
        .eq("branch_id", branch_id)
        .neq("role", "customer")
        .order("full_name")
    )

    if role:
        query = query.eq("role", role)
    if is_active is not None:
        query = query.eq("is_active", is_active)

    result = query.execute()
    data = result.data or []

    # Filter by name search (Supabase free tier doesn't support ilike on all plans)
    if search:
        search_lower = search.lower()
        data = [e for e in data if search_lower in (e.get("full_name") or "").lower()
                or search_lower in (e.get("email") or "").lower()]

    return {"data": data, "count": len(data)}


@router.get("/{employee_id}")
async def get_employee(
    employee_id: str,
    current_user: dict = Depends(require_roles("admin", "manager")),
):
    """Chi tiết nhân viên."""
    sb = get_supabase_admin()
    result = (
        sb.table("users")
        .select("id, full_name, email, phone, role, avatar_url, is_active, created_at")
        .eq("id", employee_id)
        .eq("branch_id", current_user["branch_id"])
        .maybe_single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Nhân viên không tồn tại")
    return {"data": result.data}


@router.post("")
async def create_employee(
    payload: EmployeeCreate,
    current_user: dict = Depends(require_roles("admin", "manager")),
):
    """Tạo nhân viên mới (tạo Supabase Auth user + profile)."""
    if payload.role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail=f"Role không hợp lệ. Phải là: {VALID_ROLES}")

    sb = get_supabase_admin()
    branch_id = current_user["branch_id"]

    # Tạo Auth user
    try:
        auth_result = sb.auth.admin.create_user({
            "email": payload.email,
            "password": payload.password,
            "email_confirm": True,
        })
        if not auth_result.user:
            raise HTTPException(status_code=500, detail="Không thể tạo tài khoản Auth")
        auth_user_id = auth_result.user.id
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Lỗi tạo tài khoản: {str(e)}")

    # Tạo profile trong bảng users
    try:
        profile = {
            "id": auth_user_id,
            "branch_id": branch_id,
            "full_name": payload.full_name,
            "email": payload.email,
            "role": payload.role,
            "phone": payload.phone,
            "avatar_url": payload.avatar_url,
            "is_active": True,
        }
        result = sb.table("users").insert(profile).execute()
        if not result.data:
            raise HTTPException(status_code=500, detail="Không thể tạo hồ sơ nhân viên")
    except Exception as e:
        # Rollback: xóa auth user nếu tạo profile thất bại
        try:
            sb.auth.admin.delete_user(auth_user_id)
        except Exception:
            pass
        raise HTTPException(status_code=500, detail=f"Lỗi tạo hồ sơ: {str(e)}")

    return {"data": result.data[0], "message": "Tạo nhân viên thành công"}


@router.put("/{employee_id}")
async def update_employee(
    employee_id: str,
    payload: EmployeeUpdate,
    current_user: dict = Depends(require_roles("admin", "manager")),
):
    """Cập nhật thông tin nhân viên."""
    if payload.role and payload.role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail=f"Role không hợp lệ. Phải là: {VALID_ROLES}")

    sb = get_supabase_admin()
    update_data = payload.model_dump(exclude_none=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="Không có dữ liệu cập nhật")

    result = (
        sb.table("users")
        .update(update_data)
        .eq("id", employee_id)
        .eq("branch_id", current_user["branch_id"])
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Nhân viên không tồn tại")
    return {"data": result.data[0], "message": "Cập nhật thành công"}


@router.patch("/{employee_id}/toggle-active")
async def toggle_employee_active(
    employee_id: str,
    current_user: dict = Depends(require_roles("admin")),
):
    """Kích hoạt / Vô hiệu hóa tài khoản nhân viên."""
    sb = get_supabase_admin()

    # Lấy trạng thái hiện tại
    existing = (
        sb.table("users")
        .select("id, is_active, full_name")
        .eq("id", employee_id)
        .eq("branch_id", current_user["branch_id"])
        .maybe_single()
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="Nhân viên không tồn tại")

    # Không cho phép tự vô hiệu hóa chính mình
    if employee_id == current_user["id"]:
        raise HTTPException(status_code=400, detail="Không thể vô hiệu hóa tài khoản của chính mình")

    new_status = not existing.data["is_active"]
    result = (
        sb.table("users")
        .update({"is_active": new_status})
        .eq("id", employee_id)
        .execute()
    )
    action = "Kích hoạt" if new_status else "Vô hiệu hóa"
    return {"data": result.data[0], "message": f"{action} tài khoản thành công"}
