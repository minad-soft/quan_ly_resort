from fastapi import APIRouter, Depends, HTTPException, Query
from app.dependencies import get_current_user
from app.database import get_supabase_admin
from app.schemas.bookings import BookingCreate
from typing import Optional
from datetime import datetime

router = APIRouter(prefix="/api/bookings", tags=["Bookings"])


@router.get("")
async def list_bookings(
    status: Optional[str] = Query(None),
    current_user: dict = Depends(get_current_user),
):
    """Danh sách booking theo chi nhánh."""
    sb = get_supabase_admin()
    query = (
        sb.table("bookings")
        .select("*, rooms(room_number, status), guests(full_name, phone)")
        .eq("branch_id", current_user["branch_id"])
        .order("created_at", desc=True)
    )
    if status:
        query = query.eq("status", status)

    result = query.execute()
    return {"data": result.data, "count": len(result.data)}


@router.post("")
async def create_booking(
    body: BookingCreate,
    current_user: dict = Depends(get_current_user),
):
    """Tạo booking mới."""
    sb = get_supabase_admin()
    branch_id = current_user["branch_id"]

    # Verify room belongs to branch and is available
    room = (
        sb.table("rooms")
        .select("id, status, room_type_id")
        .eq("id", body.room_id)
        .eq("branch_id", branch_id)
        .maybe_single()
        .execute()
    )
    if not room.data:
        raise HTTPException(status_code=404, detail="Room not found")
    if room.data["status"] != "available":
        raise HTTPException(status_code=400, detail=f"Room is currently '{room.data['status']}'")

    # Check for overlapping bookings
    overlaps = (
        sb.table("bookings")
        .select("id")
        .eq("room_id", body.room_id)
        .in_("status", ["pending", "confirmed", "checked_in"])
        .lt("check_in_date", body.check_out_date.isoformat())
        .gt("check_out_date", body.check_in_date.isoformat())
        .execute()
    )
    if overlaps.data:
        raise HTTPException(status_code=409, detail="Room has overlapping booking for these dates")

    # Calculate total
    days = (body.check_out_date - body.check_in_date).days
    total_amount = body.room_rate * max(days, 1)

    booking_data = {
        "branch_id": branch_id,
        "room_id": body.room_id,
        "guest_id": body.guest_id,
        "check_in_date": body.check_in_date.isoformat(),
        "check_out_date": body.check_out_date.isoformat(),
        "num_guests": body.num_guests,
        "room_rate": body.room_rate,
        "total_amount": total_amount,
        "source": body.source,
        "notes": body.notes,
        "created_by": current_user["id"],
    }

    result = sb.table("bookings").insert(booking_data).execute()
    return {"data": result.data[0], "message": "Booking created successfully"}


@router.post("/{booking_id}/check-in")
async def check_in(
    booking_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Check-in: cập nhật booking status → trigger tự đổi room status."""
    sb = get_supabase_admin()

    booking = (
        sb.table("bookings")
        .select("*")
        .eq("id", booking_id)
        .eq("branch_id", current_user["branch_id"])
        .maybe_single()
        .execute()
    )
    if not booking.data:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.data["status"] not in ("pending", "confirmed"):
        raise HTTPException(status_code=400, detail=f"Cannot check-in from status '{booking.data['status']}'")

    result = (
        sb.table("bookings")
        .update({
            "status": "checked_in",
            "actual_check_in": datetime.now().isoformat(),
        })
        .eq("id", booking_id)
        .execute()
    )
    return {"data": result.data[0], "message": "Check-in successful"}


@router.post("/{booking_id}/check-out")
async def check_out(
    booking_id: str,
    current_user: dict = Depends(get_current_user),
):
    """Check-out: cập nhật booking status → trigger tự đổi room status thành cleaning."""
    sb = get_supabase_admin()

    booking = (
        sb.table("bookings")
        .select("*")
        .eq("id", booking_id)
        .eq("branch_id", current_user["branch_id"])
        .maybe_single()
        .execute()
    )
    if not booking.data:
        raise HTTPException(status_code=404, detail="Booking not found")
    if booking.data["status"] != "checked_in":
        raise HTTPException(status_code=400, detail="Booking is not checked-in")

    result = (
        sb.table("bookings")
        .update({
            "status": "checked_out",
            "actual_check_out": datetime.now().isoformat(),
        })
        .eq("id", booking_id)
        .execute()
    )
    return {"data": result.data[0], "message": "Check-out successful"}
