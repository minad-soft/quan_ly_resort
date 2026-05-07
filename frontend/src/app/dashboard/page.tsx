"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import Link from "next/link";

interface DashboardStats {
  rooms: {
    total: number;
    available: number;
    occupied: number;
    cleaning: number;
    maintenance: number;
  };
  bookings: {
    check_ins_today: number;
    check_outs_today: number;
  };
  revenue_today: number;
  staff_present: number;
}

interface Activity {
  type: "order" | "booking";
  title: string;
  amount: number | null;
  status: string;
  created_at: string;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        // Fetch all data in parallel
        const [statsRes, revenueRes, activityRes] = await Promise.all([
          apiFetch("/api/dashboard/stats").catch(() => null),
          apiFetch("/api/dashboard/revenue").catch(() => null),
          apiFetch("/api/dashboard/recent-activity").catch(() => null),
        ]);

        if (statsRes) setStats(statsRes);
        if (revenueRes?.data) setRevenueData(revenueRes.data);
        if (activityRes?.data) setActivities(activityRes.data);
      } catch (err) {
        console.error("Failed to fetch dashboard data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const formatMoney = (n: number) =>
    n.toLocaleString("vi-VN", { style: "currency", currency: "VND" });

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getHours().toString().padStart(2, "0")}:${d
      .getMinutes()
      .toString()
      .padStart(2, "0")} - ${d.getDate()}/${d.getMonth() + 1}`;
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="skeleton h-24 rounded-2xl"></div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="col-span-2 skeleton h-80 rounded-2xl"></div>
          <div className="skeleton h-80 rounded-2xl"></div>
        </div>
      </div>
    );
  }

  // Lấy max revenue để vẽ biểu đồ thanh tương đối
  const maxRev = revenueData.length > 0 
    ? Math.max(...revenueData.map((d) => d.revenue))
    : 1000; // default to avoid division by zero

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Trang chủ</h1>
          <p className="text-sm text-gray-400 mt-1">
            Tổng quan hoạt động resort hôm nay
          </p>
        </div>
      </div>

      {/* Stats row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 stagger-children">
        {/* Doanh thu */}
        <div className="stat-card p-5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 transform translate-x-2 -translate-y-2 group-hover:scale-110 transition-transform">
            <span className="text-6xl">💰</span>
          </div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Doanh thu hôm nay
          </p>
          <p className="text-3xl font-bold text-emerald-400 mt-2">
            {stats ? formatMoney(stats.revenue_today) : "0 ₫"}
          </p>
        </div>

        {/* Đặt phòng */}
        <div className="stat-card p-5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 transform translate-x-2 -translate-y-2 group-hover:scale-110 transition-transform">
            <span className="text-6xl">📋</span>
          </div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Check-in / Check-out
          </p>
          <div className="flex items-end gap-3 mt-2">
            <div className="flex items-center gap-1">
              <span className="text-emerald-400 font-bold text-3xl">
                {stats?.bookings.check_ins_today || 0}
              </span>
              <span className="text-xs text-gray-500 mb-1">IN</span>
            </div>
            <span className="text-gray-600 font-light text-2xl">/</span>
            <div className="flex items-center gap-1">
              <span className="text-blue-400 font-bold text-3xl">
                {stats?.bookings.check_outs_today || 0}
              </span>
              <span className="text-xs text-gray-500 mb-1">OUT</span>
            </div>
          </div>
        </div>

        {/* Tình trạng phòng */}
        <div className="stat-card p-5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 transform translate-x-2 -translate-y-2 group-hover:scale-110 transition-transform">
            <span className="text-6xl">🏨</span>
          </div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Phòng đang dùng
          </p>
          <div className="flex items-end gap-2 mt-2">
            <span className="text-blue-400 font-bold text-3xl">
              {stats?.rooms.occupied || 0}
            </span>
            <span className="text-gray-500 text-sm mb-1">
              / {stats?.rooms.total || 0}
            </span>
          </div>
        </div>

        {/* Nhân sự */}
        <div className="stat-card p-5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 transform translate-x-2 -translate-y-2 group-hover:scale-110 transition-transform">
            <span className="text-6xl">👥</span>
          </div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Nhân viên ca này
          </p>
          <p className="text-3xl font-bold text-white mt-2">
            {stats?.staff_present || 0}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Biểu đồ doanh thu 7 ngày (CSS Bar Chart) */}
        <div className="lg:col-span-2 glass-card p-6 flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-bold text-white">
              Doanh thu 7 ngày qua
            </h2>
            <Link
              href="/dashboard/pos"
              className="text-xs font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              Xem chi tiết POS →
            </Link>
          </div>

          <div className="flex-1 flex items-end gap-2 h-48 mt-auto pt-4 border-b border-white/10 relative">
            {/* Horizontal lines */}
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-8">
              <div className="border-t border-white/5 w-full"></div>
              <div className="border-t border-white/5 w-full"></div>
              <div className="border-t border-white/5 w-full"></div>
            </div>

            {revenueData.length === 0 ? (
              <div className="w-full text-center text-gray-500 text-sm pb-8">
                Không có dữ liệu doanh thu
              </div>
            ) : (
              revenueData.map((item, i) => {
                const heightPercentage =
                  maxRev > 0 ? (item.revenue / maxRev) * 100 : 0;
                const d = new Date(item.date);
                const isToday = i === revenueData.length - 1;

                return (
                  <div
                    key={i}
                    className="flex-1 flex flex-col items-center justify-end group"
                  >
                    {/* Tooltip */}
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -mt-10 bg-gray-800 text-xs px-2 py-1 rounded text-white whitespace-nowrap z-10 pointer-events-none transform -translate-y-full">
                      {formatMoney(item.revenue)}
                    </div>
                    {/* Bar */}
                    <div
                      className={`w-full max-w-[40px] rounded-t-sm transition-all duration-500 ease-out ${
                        isToday
                          ? "bg-gradient-to-t from-emerald-600/50 to-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.3)]"
                          : "bg-white/10 group-hover:bg-white/20"
                      }`}
                      style={{ height: `${Math.max(heightPercentage, 2)}%` }}
                    ></div>
                    {/* Label */}
                    <span className="text-[10px] text-gray-400 mt-2 h-6">
                      {d.getDate()}/{d.getMonth() + 1}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Hoạt động gần đây */}
        <div className="glass-card p-6 flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-bold text-white">Hoạt động mới</h2>
          </div>

          <div className="flex-1 overflow-y-auto space-y-4 pr-2">
            {activities.length === 0 ? (
              <p className="text-sm text-gray-500 text-center mt-10">
                Chưa có hoạt động nào
              </p>
            ) : (
              activities.map((act, i) => (
                <div
                  key={i}
                  className="flex gap-3 items-start p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
                >
                  <div
                    className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                      act.type === "order"
                        ? "bg-amber-500/20 text-amber-400"
                        : "bg-blue-500/20 text-blue-400"
                    }`}
                  >
                    {act.type === "order" ? "🍽️" : "🏨"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {act.title}
                    </p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-gray-400">
                        {formatDate(act.created_at)}
                      </span>
                      {act.amount !== null && (
                        <span className="text-xs font-semibold text-emerald-400">
                          {formatMoney(act.amount)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
          
          <div className="mt-4 pt-4 border-t border-white/10">
            <div className="flex justify-between items-center">
                <span className="text-xs text-gray-400">Phòng cần dọn:</span>
                <span className="text-sm font-bold text-amber-400">{stats?.rooms.cleaning || 0}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
