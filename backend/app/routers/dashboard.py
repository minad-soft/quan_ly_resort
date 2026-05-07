from fastapi import APIRouter, Depends
from app.dependencies import get_current_user, require_roles
from app.database import get_supabase_admin
from datetime import date, datetime, timedelta

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])

@router.get("/stats")
async def get_dashboard_stats(current_user: dict = Depends(get_current_user)):
    """Lấy thống kê tổng quan cho Dashboard."""
    sb = get_supabase_admin()
    branch_id = current_user["branch_id"]
    today = date.today().isoformat()
    now = datetime.now()

    # 1. Thống kê phòng
    rooms = sb.table("rooms").select("status").eq("branch_id", branch_id).execute()
    room_data = rooms.data
    room_stats = {
        "total": len(room_data),
        "available": len([r for r in room_data if r["status"] == "available"]),
        "occupied": len([r for r in room_data if r["status"] == "occupied"]),
        "cleaning": len([r for r in room_data if r["status"] == "cleaning"]),
        "maintenance": len([r for r in room_data if r["status"] == "maintenance"]),
    }

    # 2. Đặt phòng hôm nay (Check-in / Check-out)
    start_of_day = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    end_of_day = now.replace(hour=23, minute=59, second=59, microsecond=999999).isoformat()
    
    bookings = sb.table("bookings").select("id, status, check_in_date, check_out_date").eq("branch_id", branch_id).execute()
    booking_data = bookings.data
    
    check_ins_today = len([b for b in booking_data if b["check_in_date"] >= start_of_day and b["check_in_date"] <= end_of_day])
    check_outs_today = len([b for b in booking_data if b["check_out_date"] >= start_of_day and b["check_out_date"] <= end_of_day])

    # 3. Doanh thu hôm nay (Tính theo các order 'completed' hoặc 'paid')
    orders_today = sb.table("orders").select("final_amount").eq("branch_id", branch_id).gte("created_at", start_of_day).lte("created_at", end_of_day).in_("payment_status", ["paid", "partial"]).execute()
    revenue_today = sum(o.get("final_amount", 0) for o in orders_today.data)

    # 4. Nhân sự đi làm hôm nay
    attendance = sb.table("attendance").select("id, status").eq("branch_id", branch_id).eq("work_date", today).execute()
    staff_present = len([a for a in attendance.data if a["status"] in ["present", "late", "half_day"]])

    return {
        "rooms": room_stats,
        "bookings": {
            "check_ins_today": check_ins_today,
            "check_outs_today": check_outs_today,
        },
        "revenue_today": revenue_today,
        "staff_present": staff_present
    }

@router.get("/revenue")
async def get_revenue_chart(current_user: dict = Depends(require_roles("admin", "manager", "ke_toan"))):
    """Lấy dữ liệu doanh thu 7 ngày qua."""
    sb = get_supabase_admin()
    branch_id = current_user["branch_id"]
    
    # Tính từ 6 ngày trước + hôm nay = 7 ngày
    dates = [(date.today() - timedelta(days=i)) for i in range(6, -1, -1)]
    start_date = dates[0].isoformat() + "T00:00:00"
    end_date = dates[-1].isoformat() + "T23:59:59"

    orders = sb.table("orders").select("final_amount, created_at").eq("branch_id", branch_id).gte("created_at", start_date).lte("created_at", end_date).in_("payment_status", ["paid", "partial"]).execute()
    
    revenue_by_date = {d.isoformat(): 0 for d in dates}
    for order in orders.data:
        # Lấy phần yyyy-mm-dd của created_at
        order_date = order["created_at"][:10]
        if order_date in revenue_by_date:
            revenue_by_date[order_date] += order.get("final_amount", 0)

    # Format output cho frontend dễ vẽ biểu đồ
    chart_data = [{"date": d, "revenue": rev} for d, rev in revenue_by_date.items()]
    
    return {"data": chart_data}

@router.get("/recent-activity")
async def get_recent_activity(current_user: dict = Depends(get_current_user)):
    """Hoạt động gần đây (đơn hàng mới, đặt phòng mới)."""
    sb = get_supabase_admin()
    branch_id = current_user["branch_id"]
    
    # Lấy 5 đơn hàng mới nhất
    recent_orders = sb.table("orders").select("order_number, total_amount, status, created_at").eq("branch_id", branch_id).order("created_at", desc=True).limit(5).execute()
    
    # Lấy 5 đặt phòng mới nhất
    recent_bookings = sb.table("bookings").select("id, status, guest_id, created_at, guests(full_name)").eq("branch_id", branch_id).order("created_at", desc=True).limit(5).execute()
    
    activities = []
    for o in recent_orders.data:
        activities.append({
            "type": "order",
            "title": f"Đơn hàng mới {o['order_number']}",
            "amount": o["total_amount"],
            "status": o["status"],
            "created_at": o["created_at"]
        })
        
    for b in recent_bookings.data:
        guest_name = b.get("guests", {}).get("full_name", "Khách") if b.get("guests") else "Khách"
        activities.append({
            "type": "booking",
            "title": f"Đặt phòng mới từ {guest_name}",
            "amount": None,
            "status": b["status"],
            "created_at": b["created_at"]
        })
        
    # Sắp xếp chung theo thời gian giảm dần
    activities.sort(key=lambda x: x["created_at"], desc=True)
    
    return {"data": activities[:10]}
