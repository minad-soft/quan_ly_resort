import re
import hmac
import hashlib
from fastapi import APIRouter, Request, HTTPException
from app.database import get_supabase_admin
from app.config import get_settings

router = APIRouter(prefix="/webhook", tags=["Webhooks"])

# Pattern: "SEVQR ROM ORD-260508-0001"
ORDER_PATTERN = re.compile(r"ORD-\d{6}-\d{4}")


@router.post("/sepay")
async def sepay_webhook(request: Request):
    """
    Nhận webhook từ Sepay khi có giao dịch chuyển khoản.
    Parse nội dung chuyển khoản để match order_number.
    Format: SEVQR ROM ORD-YYMMDD-XXXX
    """
    settings = get_settings()

    # Verify webhook signature if secret is configured
    if settings.sepay_webhook_secret:
        signature = request.headers.get("x-sepay-signature", "")
        body_bytes = await request.body()
        expected = hmac.new(
            settings.sepay_webhook_secret.encode(),
            body_bytes,
            hashlib.sha256,
        ).hexdigest()

        if not hmac.compare_digest(signature, expected):
            raise HTTPException(status_code=401, detail="Invalid webhook signature")

    payload = await request.json()

    # Sepay webhook payload fields
    transfer_content = payload.get("content", "")  # Nội dung CK
    amount = payload.get("transferAmount", 0)
    transaction_ref = payload.get("referenceCode", "")
    bank_account = payload.get("bankSubAccId", "")  # Số TK nhận

    if not transfer_content or amount <= 0:
        return {"success": False, "message": "Invalid payload"}

    # Extract order number from transfer content
    match = ORDER_PATTERN.search(transfer_content)
    if not match:
        return {"success": False, "message": "No order number found in transfer content"}

    order_number = match.group(0)

    sb = get_supabase_admin()

    # Find order
    order_result = (
        sb.table("orders")
        .select("id, branch_id, final_amount, payment_status")
        .eq("order_number", order_number)
        .maybe_single()
        .execute()
    )

    if not order_result.data:
        return {"success": False, "message": f"Order {order_number} not found"}

    order = order_result.data

    if order["payment_status"] == "paid":
        return {"success": True, "message": "Order already paid"}

    # Find matching payment method (bank_transfer with matching account)
    pm_result = (
        sb.table("branch_payment_methods")
        .select("id, bank_account_id, branch_bank_accounts(account_number)")
        .eq("branch_id", order["branch_id"])
        .eq("method_type", "bank_transfer")
        .eq("is_active", True)
        .execute()
    )

    payment_method_id = None
    for pm in pm_result.data or []:
        bank_info = pm.get("branch_bank_accounts")
        if bank_info and bank_info.get("account_number") == bank_account:
            payment_method_id = pm["id"]
            break

    if not payment_method_id and pm_result.data:
        payment_method_id = pm_result.data[0]["id"]

    # Create payment record (trigger will auto-update order payment_status)
    sb.table("payments").insert({
        "branch_id": order["branch_id"],
        "order_id": order["id"],
        "payment_method_id": payment_method_id,
        "amount": amount,
        "transaction_ref": transaction_ref,
        "status": "success",
        "notes": f"Sepay auto: {transfer_content}",
    }).execute()

    return {
        "success": True,
        "message": f"Payment recorded for {order_number}",
        "order_id": order["id"],
        "amount": amount,
    }
