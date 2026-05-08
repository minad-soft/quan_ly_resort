from fastapi import Depends, HTTPException, status, Header
from supabase import Client
from app.database import get_supabase, get_supabase_admin

async def get_current_user(
    authorization: str = Header(..., description="Bearer <access_token>"),
) -> dict:
    """
    Xác thực user từ Supabase Auth JWT token.
    Returns user dict with id, email, branch_id, role.
    """
    if not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization header",
        )

    token = authorization.replace("Bearer ", "")
    sb: Client = get_supabase()

    try:
        # Verify token with Supabase Auth
        user_response = sb.auth.get_user(token)
        if not user_response or not user_response.user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token",
            )

        auth_user = user_response.user

        # Get user profile with branch_id and role
        # Use admin client to bypass RLS for auth middleware
        sb_admin = get_supabase_admin()
        profile = (
            sb_admin.table("users")
            .select("id, branch_id, full_name, email, role, is_active")
            .eq("id", auth_user.id)
            .maybe_single()
            .execute()
        )

        if not profile.data:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User profile not found",
            )

        if not profile.data.get("is_active"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User account is deactivated",
            )

        return profile.data

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Authentication failed: {str(e)}",
        )


def require_roles(*allowed_roles: str):
    """Dependency factory: restrict endpoint to specific roles."""

    async def check_role(current_user: dict = Depends(get_current_user)) -> dict:
        if current_user["role"] not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{current_user['role']}' not allowed. Required: {allowed_roles}",
            )
        return current_user

    return check_role
