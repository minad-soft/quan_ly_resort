from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from fastapi.responses import StreamingResponse
from app.dependencies import get_current_user, require_roles
from app.database import get_supabase_admin
from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime
import csv
import io

router = APIRouter(prefix="/api/attendance", tags=["Attendance"])


class AttendanceCheckIn(BaseModel):
    shift_id: Optional[str] = None
    work_date: Optional[str] = None  # YYYY-MM-DD, defaults to today


class AttendanceCheckOut(BaseModel):
    pass


class AttendanceUpdate(BaseModel):
    status: Optional[str] = None
    overtime_hours: Optional[float] = None
    notes: Optional[str] = None
    shift_id: Optional[str] = None


@router.get("")
async def list_attendance(
    work_date: Optional[str] = Query(None, description="YYYY-MM-DD"),
    user_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    current_user: dict = Depends(get_current_user),
):
    """Danh sách chấm công theo ngày."""
    sb = get_supabase_admin()
    query = (
        sb.table("attendance")
        .select("*, users(full_name, role), shifts(name, start_time, end_time)")
        .eq("branch_id", current_user["branch_id"])
        .order("work_date", desc=True)
    )
    if work_date:
        query = query.eq("work_date", work_date)
    if user_id:
        query = query.eq("user_id", user_id)
    if status:
        query = query.eq("status", status)

    # Phân trang
    offset = (page - 1) * page_size
    query = query.range(offset, offset + page_size - 1)

    result = query.execute()
    return {"data": result.data, "count": len(result.data), "page": page}


@router.post("/check-in")
async def attendance_check_in(
    body: AttendanceCheckIn,
    current_user: dict = Depends(get_current_user),
):
    """Chấm công vào ca."""
    sb = get_supabase_admin()
    today = body.work_date or date.today().isoformat()

    # Kiểm tra đã chấm công chưa
    existing = (
        sb.table("attendance")
        .select("id")
        .eq("user_id", current_user["id"])
        .eq("work_date", today)
        .execute()
    )
    if existing.data:
        raise HTTPException(status_code=400, detail="Đã chấm công hôm nay")

    record = {
        "branch_id": current_user["branch_id"],
        "user_id": current_user["id"],
        "shift_id": body.shift_id,
        "work_date": today,
        "check_in_time": datetime.now().isoformat(),
        "status": "present",
    }

    result = sb.table("attendance").insert(record).execute()
    return {"data": result.data[0], "message": "Chấm công vào thành công"}


@router.post("/{attendance_id}/check-out")
async def attendance_check_out(
    attendance_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Chấm công ra ca."""
    sb = get_supabase_admin()

    record = (
        sb.table("attendance")
        .select("*")
        .eq("id", attendance_id)
        .eq("user_id", current_user["id"])
        .single()
        .execute()
    )
    if not record.data:
        raise HTTPException(status_code=404, detail="Bản ghi chấm công không tồn tại")
    if record.data.get("check_out_time"):
        raise HTTPException(status_code=400, detail="Đã chấm công ra")

    result = (
        sb.table("attendance")
        .update({"check_out_time": datetime.now().isoformat()})
        .eq("id", attendance_id)
        .execute()
    )
    return {"data": result.data[0], "message": "Chấm công ra thành công"}


@router.patch("/{attendance_id}")
async def update_attendance(
    attendance_id: str,
    body: AttendanceUpdate,
    current_user: dict = Depends(require_roles("admin", "manager")),
):
    """Cập nhật bản ghi chấm công (admin/manager)."""
    sb = get_supabase_admin()

    existing = (
        sb.table("attendance")
        .select("id")
        .eq("id", attendance_id)
        .eq("branch_id", current_user["branch_id"])
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="Bản ghi chấm công không tồn tại")

    update_data = body.model_dump(exclude_none=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="Không có dữ liệu cập nhật")

    result = (
        sb.table("attendance")
        .update(update_data)
        .eq("id", attendance_id)
        .execute()
    )
    return {"data": result.data[0], "message": "Cập nhật thành công"}


@router.get("/my-today")
async def my_today_attendance(
    current_user: dict = Depends(get_current_user),
):
    """Lấy chấm công hôm nay của user hiện tại."""
    sb = get_supabase_admin()
    today = date.today().isoformat()

    result = (
        sb.table("attendance")
        .select("*, shifts(name)")
        .eq("user_id", current_user["id"])
        .eq("work_date", today)
        .execute()
    )
    return {"data": result.data[0] if result.data else None}


@router.get("/report/monthly")
async def monthly_report(
    month: int = Query(..., ge=1, le=12),
    year: int = Query(..., ge=2020),
    user_id: Optional[str] = Query(None),
    current_user: dict = Depends(require_roles("admin", "manager", "ke_toan")),
):
    """Báo cáo chấm công tháng – tổng hợp theo nhân viên."""
    sb = get_supabase_admin()
    branch_id = current_user["branch_id"]

    start_date = f"{year}-{month:02d}-01"
    if month == 12:
        end_date = f"{year + 1}-01-01"
    else:
        end_date = f"{year}-{month + 1:02d}-01"

    query = (
        sb.table("attendance")
        .select("*, users(full_name, role), shifts(name)")
        .eq("branch_id", branch_id)
        .gte("work_date", start_date)
        .lt("work_date", end_date)
        .order("work_date", desc=False)
    )
    if user_id:
        query = query.eq("user_id", user_id)

    result = query.execute()
    records = result.data

    # Tổng hợp theo user
    summary: dict = {}
    for r in records:
        uid = r["user_id"]
        if uid not in summary:
            user_info = r.get("users") or {}
            summary[uid] = {
                "user_id": uid,
                "full_name": user_info.get("full_name", ""),
                "role": user_info.get("role", ""),
                "total_present": 0,
                "total_late": 0,
                "total_absent": 0,
                "total_half_day": 0,
                "total_leave": 0,
                "total_overtime_hours": 0,
                "total_work_days": 0,
            }
        s = summary[uid]
        status = r.get("status", "")
        if status == "present":
            s["total_present"] += 1
            s["total_work_days"] += 1
        elif status == "late":
            s["total_late"] += 1
            s["total_work_days"] += 1
        elif status == "absent":
            s["total_absent"] += 1
        elif status == "half_day":
            s["total_half_day"] += 1
            s["total_work_days"] += 0.5
        elif status == "leave":
            s["total_leave"] += 1
        s["total_overtime_hours"] += r.get("overtime_hours", 0) or 0

    return {
        "month": month,
        "year": year,
        "summary": list(summary.values()),
        "detail": records,
        "total_records": len(records),
    }


# ===== Bulk Import / Export =====

@router.post("/bulk-import")
async def bulk_import_attendance(
    file: UploadFile = File(...),
    current_user: dict = Depends(require_roles("admin", "manager")),
):
    """
    Nhập chấm công hàng loạt từ file CSV.
    Cột bắt buộc: user_id, work_date, status
    Cột tùy chọn: shift_id, overtime_hours, notes
    """
    sb = get_supabase_admin()
    branch_id = current_user["branch_id"]

    if not file.filename or not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Chỉ chấp nhận file CSV")

    content = await file.read()
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = content.decode("latin-1")

    reader = csv.DictReader(io.StringIO(text))
    records = []
    errors = []
    row_num = 1

    for row in reader:
        row_num += 1
        user_id = row.get("user_id", "").strip()
        work_date = row.get("work_date", "").strip()
        status = row.get("status", "present").strip()

        if not user_id or not work_date:
            errors.append(f"Dòng {row_num}: Thiếu user_id hoặc work_date")
            continue

        # Validate status
        valid_statuses = ["present", "absent", "late", "half_day", "leave"]
        if status not in valid_statuses:
            errors.append(f"Dòng {row_num}: Status '{status}' không hợp lệ")
            continue

        record = {
            "branch_id": branch_id,
            "user_id": user_id,
            "work_date": work_date,
            "status": status,
        }

        if row.get("shift_id", "").strip():
            record["shift_id"] = row["shift_id"].strip()
        if row.get("overtime_hours", "").strip():
            try:
                record["overtime_hours"] = float(row["overtime_hours"])
            except ValueError:
                errors.append(f"Dòng {row_num}: overtime_hours không hợp lệ")
                continue
        if row.get("notes", "").strip():
            record["notes"] = row["notes"].strip()

        records.append(record)

    if not records:
        raise HTTPException(
            status_code=400,
            detail=f"Không có dữ liệu hợp lệ để nhập. Lỗi: {'; '.join(errors)}"
        )

    # Upsert để tránh trùng
    result = sb.table("attendance").upsert(
        records, on_conflict="user_id,work_date,shift_id"
    ).execute()

    return {
        "message": f"Nhập thành công {len(result.data)} bản ghi",
        "imported": len(result.data),
        "errors": errors,
    }


@router.get("/bulk-export")
async def bulk_export_attendance(
    start_date: str = Query(..., description="YYYY-MM-DD"),
    end_date: str = Query(..., description="YYYY-MM-DD"),
    current_user: dict = Depends(require_roles("admin", "manager", "ke_toan")),
):
    """Xuất dữ liệu chấm công ra file CSV."""
    sb = get_supabase_admin()
    branch_id = current_user["branch_id"]

    result = (
        sb.table("attendance")
        .select("*, users(full_name, role), shifts(name)")
        .eq("branch_id", branch_id)
        .gte("work_date", start_date)
        .lte("work_date", end_date)
        .order("work_date", desc=False)
        .execute()
    )

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "user_id", "full_name", "role", "work_date",
        "shift_name", "check_in_time", "check_out_time",
        "status", "overtime_hours", "notes"
    ])

    for r in result.data:
        user_info = r.get("users") or {}
        shift_info = r.get("shifts") or {}
        writer.writerow([
            r.get("user_id", ""),
            user_info.get("full_name", ""),
            user_info.get("role", ""),
            r.get("work_date", ""),
            shift_info.get("name", ""),
            r.get("check_in_time", ""),
            r.get("check_out_time", ""),
            r.get("status", ""),
            r.get("overtime_hours", 0),
            r.get("notes", ""),
        ])

    output.seek(0)
    filename = f"attendance_{start_date}_to_{end_date}.csv"

    return StreamingResponse(
        io.BytesIO(output.getvalue().encode("utf-8-sig")),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
