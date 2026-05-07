from supabase import create_client, Client
from app.config import get_settings

_supabase_client: Client | None = None
_supabase_admin: Client | None = None


def get_supabase() -> Client:
    """Get Supabase client with anon key (respects RLS)."""
    global _supabase_client
    if _supabase_client is None:
        settings = get_settings()
        _supabase_client = create_client(settings.supabase_url, settings.supabase_anon_key)
    return _supabase_client


def get_supabase_admin() -> Client:
    """Get Supabase client with service_role key (bypasses RLS)."""
    global _supabase_admin
    if _supabase_admin is None:
        settings = get_settings()
        _supabase_admin = create_client(settings.supabase_url, settings.supabase_service_role_key)
    return _supabase_admin
