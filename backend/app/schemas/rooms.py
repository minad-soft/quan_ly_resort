from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class RoomResponse(BaseModel):
    id: str
    branch_id: str
    room_type_id: Optional[str] = None
    room_number: str
    floor: Optional[int] = None
    status: str
    notes: Optional[str] = None
    created_at: Optional[datetime] = None
    # Joined fields
    room_type: Optional[dict] = None


class RoomStatusUpdate(BaseModel):
    status: str  # available, occupied, cleaning, maintenance, out_of_service
