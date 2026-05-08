from fastapi import APIRouter, Depends, HTTPException, Query
from app.dependencies import require_roles
from app.database import get_supabase_admin
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/api/payroll", tags=["Payroll"])


class PayrollCreate(BaseModel):
    user_id: str
    month: int
    year: int
    base_salary: float
    bonus: float = 0
    deductions: float = 0
    notes: Optional[str] = None


class PayrollStatusUpdate(BaseModel):
    status: str  # draft, confirmed, paid


@router.get("")
async def list_payroll(
    month: Optional[int] = Query(None),
    year: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    current_user: dict = Depends(require_roles("admin", "manager", "ke_toan")),
):
    """Danh sách bảng lương."""
    sb = get_supabase_admin()
    query = (
        sb.table("payroll")
        .select("*, users(full_name, role)")
        .eq("branch_id", current_user["branch_id"])
        .order("year", desc=True)
        .order("month", desc=True)
    )
    if month:
        query = query.eq("month", month)
    if year:
        query = query.eq("year", year)
    if status:
        query = query.eq("status", status)

    result = query.execute()
    return {"data": result.data, "count": len(result.data)}


@router.get("/summary/{user_id}/{year}/{month}")
async def payroll_summary(
    user_id: str,
    year: int,
    month: int,
    current_user: dict = Depends(require_roles("admin", "manager", "ke_toan")),
):
    """Chi tiết bảng lương một nhân viên theo tháng."""
    sb = get_supabase_admin()
    branch_id = current_user["branch_id"]

    # Lấy payroll
    payroll = (
        sb.table("payroll")
        .select("*, users(full_name, role, email)")
        .eq("branch_id", branch_id)
        .eq("user_id", user_id)
        .eq("year", year)
        .eq("month", month)
        .maybe_single()
        .execute()
    )

    # Lấy chi tiết chấm công trong tháng
    start_date = f"{year}-{month:02d}-01"
    if month == 12:
        end_date = f"{year + 1}-01-01"
    else:
        end_date = f"{year}-{month + 1:02d}-01"

    attendance = (
        sb.table("attendance")
        .select("*, shifts(name)")
        .eq("user_id", user_id)
        .eq("branch_id", branch_id)
        .gte("work_date", start_date)
        .lt("work_date", end_date)
        .order("work_date", desc=False)
        .execute()
    )

    return {
        "payroll": payroll.data,
        "attendance_detail": attendance.data,
        "attendance_count": len(attendance.data),
    }


@router.post("/calculate")
async def calculate_payroll(
    body: PayrollCreate,
    current_user: dict = Depends(require_roles("admin", "manager", "ke_toan")),
):
    """Tính lương cho nhân viên theo tháng."""
    sb = get_supabase_admin()
    branch_id = current_user["branch_id"]

    # Đếm chấm công trong tháng
    start_date = f"{body.year}-{body.month:02d}-01"
    if body.month == 12:
        end_date = f"{body.year + 1}-01-01"
    else:
        end_date = f"{body.year}-{body.month + 1:02d}-01"

    attendance = (
        sb.table("attendance")
        .select("id, status, overtime_hours")
        .eq("user_id", body.user_id)
        .eq("branch_id", branch_id)
        .gte("work_date", start_date)
        .lt("work_date", end_date)
        .execute()
    )

    total_work_days = len([a for a in attendance.data if a["status"] in ("present", "late")])
    half_days = len([a for a in attendance.data if a["status"] == "half_day"])
    total_work_days += half_days * 0.5
    total_overtime = sum(a.get("overtime_hours", 0) or 0 for a in attendance.data)

    # Tính toán
    daily_rate = body.base_salary / 26  # 26 ngày công/tháng
    overtime_rate = daily_rate / 8 * 1.5  # 1.5x giờ làm thêm
    overtime_pay = total_overtime * overtime_rate
    net_salary = body.base_salary + overtime_pay + body.bonus - body.deductions

    payroll_data = {
        "branch_id": branch_id,
        "user_id": body.user_id,
        "month": body.month,
        "year": body.year,
        "base_salary": body.base_salary,
        "total_work_days": int(total_work_days),
        "total_overtime_hours": total_overtime,
        "overtime_pay": round(overtime_pay, 0),
        "bonus": body.bonus,
        "deductions": body.deductions,
        "net_salary": round(net_salary, 0),
        "notes": body.notes,
    }

    # Upsert
    result = sb.table("payroll").upsert(payroll_data, on_conflict="user_id,month,year").execute()
    return {"data": result.data[0], "message": "Tính lương thành công"}


@router.patch("/{payroll_id}/status")
async def update_payroll_status(
    payroll_id: str,
    body: PayrollStatusUpdate,
    current_user: dict = Depends(require_roles("admin", "manager")),
):
    """Cập nhật trạng thái bảng lương (draft -> confirmed -> paid)."""
    sb = get_supabase_admin()
    valid_statuses = ["draft", "confirmed", "paid"]
    if body.status not in valid_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Trạng thái không hợp lệ. Cho phép: {valid_statuses}"
        )

    existing = (
        sb.table("payroll")
        .select("id, status")
        .eq("id", payroll_id)
        .eq("branch_id", current_user["branch_id"])
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="Bảng lương không tồn tại")

    result = (
        sb.table("payroll")
        .update({"status": body.status})
        .eq("id", payroll_id)
        .execute()
    )
    return {"data": result.data[0], "message": f"Đã chuyển trạng thái sang '{body.status}'"}
