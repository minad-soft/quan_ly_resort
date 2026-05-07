from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class OrderItemCreate(BaseModel):
    menu_item_id: str
    quantity: float
    notes: Optional[str] = None


class OrderCreate(BaseModel):
    booking_id: Optional[str] = None
    order_type: str = "fnb"  # fnb, service, retail, room_charge
    items: list[OrderItemCreate]
    discount_amount: float = 0
    notes: Optional[str] = None


class OrderResponse(BaseModel):
    id: str
    branch_id: str
    booking_id: Optional[str] = None
    order_number: Optional[str] = None
    order_type: str
    status: str
    total_amount: float
    discount_amount: float
    final_amount: float
    payment_status: str
    notes: Optional[str] = None
    created_by: Optional[str] = None
    created_at: Optional[datetime] = None
    # Joined
    order_details: Optional[list[dict]] = None
