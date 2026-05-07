"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";

const NAV_ITEMS = [
  { href: "/dashboard/rooms", label: "Sơ đồ phòng", icon: "🏨" },
  { href: "/dashboard/pos", label: "POS Order", icon: "🍽️" },
  { href: "/dashboard/bookings", label: "Đặt phòng", icon: "📋" },
  { href: "/dashboard/inventory", label: "Kho", icon: "📦" },
  { href: "/dashboard/housekeeping", label: "Buồng phòng", icon: "🧹" },
  { href: "/dashboard/attendance", label: "Chấm công", icon: "⏰" },
  { href: "/dashboard/payroll", label: "Bảng lương", icon: "💰" },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const supabase = createClient();

    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }
      setUser(session.user);

      // Get profile
      const { data } = await supabase
        .from("users")
        .select("full_name, role, branch_id, branches(name)")
        .eq("id", session.user.id)
        .single();

      if (data) setProfile(data);
    };

    getUser();
  }, [router]);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="animate-spin h-8 w-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const roleLabels: Record<string, string> = {
    admin: "Quản trị viên",
    manager: "Quản lý",
    receptionist: "Lễ tân",
    housekeeping: "Buồng phòng",
    kitchen: "Bếp",
    cashier: "Thu ngân",
    customer: "Khách hàng",
  };

  return (
    <div className="min-h-screen flex bg-gray-950">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? "w-64" : "w-20"
        } flex flex-col bg-gray-900/50 border-r border-white/5 transition-all duration-300`}
      >
        {/* Logo */}
        <div className="p-4 flex items-center gap-3 border-b border-white/5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
            R
          </div>
          {sidebarOpen && (
            <div>
              <h1 className="font-bold text-white text-sm">ROM Resort</h1>
              <p className="text-xs text-gray-400 truncate">
                {(profile?.branches as any)?.name || "..."}
              </p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <span className="text-lg flex-shrink-0">{item.icon}</span>
                {sidebarOpen && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* User info */}
        <div className="p-3 border-t border-white/5">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {profile?.full_name?.[0] || "?"}
            </div>
            {sidebarOpen && (
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-white truncate">
                  {profile?.full_name || "..."}
                </p>
                <p className="text-xs text-gray-400">
                  {roleLabels[profile?.role] || profile?.role}
                </p>
              </div>
            )}
          </div>
          <button
            onClick={handleLogout}
            className="w-full mt-2 px-3 py-2 text-sm text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl text-left flex items-center gap-3"
          >
            <span>🚪</span>
            {sidebarOpen && <span>Đăng xuất</span>}
          </button>
        </div>

        {/* Toggle */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-3 border-t border-white/5 text-gray-500 hover:text-white text-sm"
        >
          {sidebarOpen ? "◀ Thu gọn" : "▶"}
        </button>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
