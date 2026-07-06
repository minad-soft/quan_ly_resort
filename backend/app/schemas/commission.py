"""
Schemas cho tính năng Gói vé & Hoa hồng tài xế.
- PackageInclude: quản lý các item con trong gói combo
- CommissionSetting: cấu hình hoa hồng cho từng item
- CommissionTicket: phiếu chi hoa hồng tài xế
"""

from pydantic import BaseModel
from typing import Optional
from datetime import datetime


# ──────────────────────────────────────────────
# Package Includes (Gói vé / Combo)
# ──────────────────────────────────────────────

class PackageIncludeCreate(BaseModel):
    parent_item_id: str
    child_item_id: str
    quantity: int = 1


class PackageIncludeUpdate(BaseModel):
    quantity: Optional[int] = None


class PackageIncludeResponse(BaseModel):
    id: str
    branch_id: str
    parent_item_id: str
    child_item_id: str
    quantity: int
    created_at: Optional[datetime] = None


# ──────────────────────────────────────────────
# Commission Settings (Cấu hình hoa hồng)
# ──────────────────────────────────────────────

class CommissionSettingCreate(BaseModel):
    menu_item_id: str
    commission_type: str = "fixed"  # 'fixed' | 'percentage'
    commission_value: float = 0


class CommissionSettingUpdate(BaseModel):
    commission_type: Optional[str] = None
    commission_value: Optional[float] = None
    is_active: Optional[bool] = None


class CommissionSettingResponse(BaseModel):
    id: str
    branch_id: str
    menu_item_id: str
    commission_type: str
    commission_value: float
    is_active: bool
    created_at: Optional[datetime] = None


# ──────────────────────────────────────────────
# Commission Tickets (Phiếu chi hoa hồng)
# ──────────────────────────────────────────────

class CommissionTicketCreate(BaseModel):
    order_id: str
    menu_item_id: str
    driver_name: str
    driver_phone: str
    amount: float


class CommissionTicketPay(BaseModel):
    payment_method: str  # 'cash' | 'transfer'


class CommissionTicketResponse(BaseModel):
    id: str
    branch_id: str
    code: str
    order_id: str
    menu_item_id: Optional[str] = None
    driver_name: str
    driver_phone: str
    amount: float
    status: str
    payment_method: Optional[str] = None
    paid_at: Optional[datetime] = None
    paid_by: Optional[str] = None
    created_by: Optional[str] = None
    created_at: Optional[datetime] = None
