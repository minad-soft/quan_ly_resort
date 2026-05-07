from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class BookingCreate(BaseModel):
    room_id: str
    guest_id: str
    check_in_date: datetime
    check_out_date: datetime
    num_guests: int = 1
    room_rate: float
    notes: Optional[str] = None
    source: str = "walk_in"


class BookingResponse(BaseModel):
    id: str
    branch_id: str
    room_id: str
    guest_id: str
    check_in_date: datetime
    check_out_date: datetime
    actual_check_in: Optional[datetime] = None
    actual_check_out: Optional[datetime] = None
    num_guests: int
    room_rate: float
    total_amount: float
    status: str
    source: Optional[str] = None
    notes: Optional[str] = None
    created_by: Optional[str] = None
    created_at: Optional[datetime] = None
    # Joined
    room: Optional[dict] = None
    guest: Optional[dict] = None
