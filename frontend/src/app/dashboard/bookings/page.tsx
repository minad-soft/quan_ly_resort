"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

export default function BookingsPage() {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    const fetchBookings = async () => {
      try {
        const params = filter !== "all" ? `?status=${filter}` : "";
        const result = await apiFetch(`/api/bookings${params}`);
        setBookings(result.data);
      } catch (err) {
        console.error("Failed to fetch bookings:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchBookings();
  }, [filter]);

  const statusColors: Record<string, string> = {
    pending: "bg-amber-500/15 text-amber-400",
    confirmed: "bg-blue-500/15 text-blue-400",
    checked_in: "bg-emerald-500/15 text-emerald-400",
    checked_out: "bg-gray-500/15 text-gray-400",
    cancelled: "bg-red-500/15 text-red-400",
  };

  const statusLabels: Record<string, string> = {
    pending: "Chờ xác nhận",
    confirmed: "Đã xác nhận",
    checked_in: "Đã nhận phòng",
    checked_out: "Đã trả phòng",
    cancelled: "Đã hủy",
  };

  const handleCheckIn = async (id: string) => {
    try {
      await apiFetch(`/api/bookings/${id}/check-in`, { method: "POST" });
      setLoading(true);
      const result = await apiFetch("/api/bookings");
      setBookings(result.data);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCheckOut = async (id: string) => {
    try {
      await apiFetch(`/api/bookings/${id}/check-out`, { method: "POST" });
      setLoading(true);
      const result = await apiFetch("/api/bookings");
      setBookings(result.data);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Quản lý đặt phòng</h1>
        <p className="text-gray-400 text-sm mt-1">Danh sách booking & check-in/check-out</p>
      </div>

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {["all", "pending", "confirmed", "checked_in", "checked_out"].map((s) => (
          <button
            key={s}
            onClick={() => { setFilter(s); setLoading(true); }}
            className={`px-4 py-2 rounded-xl text-sm font-medium border ${
              filter === s
                ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                : "bg-white/5 border-white/10 text-gray-400 hover:text-white"
            }`}
          >
            {s === "all" ? "Tất cả" : statusLabels[s] || s}
          </button>
        ))}
      </div>

      {/* Bookings Table */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin h-8 w-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
        </div>
      ) : bookings.length === 0 ? (
        <div className="text-center text-gray-500 py-20">
          <p className="text-4xl mb-2">📋</p>
          <p>Chưa có booking nào</p>
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="px-4 py-3 text-left text-gray-400 font-medium">Phòng</th>
                  <th className="px-4 py-3 text-left text-gray-400 font-medium">Khách</th>
                  <th className="px-4 py-3 text-left text-gray-400 font-medium">Nhận phòng</th>
                  <th className="px-4 py-3 text-left text-gray-400 font-medium">Trả phòng</th>
                  <th className="px-4 py-3 text-left text-gray-400 font-medium">Tổng tiền</th>
                  <th className="px-4 py-3 text-left text-gray-400 font-medium">Trạng thái</th>
                  <th className="px-4 py-3 text-left text-gray-400 font-medium">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => (
                  <tr key={b.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="px-4 py-3 text-white font-medium">{b.rooms?.room_number || "—"}</td>
                    <td className="px-4 py-3 text-gray-300">{b.guests?.full_name || "—"}</td>
                    <td className="px-4 py-3 text-gray-300">
                      {new Date(b.check_in_date).toLocaleDateString("vi-VN")}
                    </td>
                    <td className="px-4 py-3 text-gray-300">
                      {new Date(b.check_out_date).toLocaleDateString("vi-VN")}
                    </td>
                    <td className="px-4 py-3 text-emerald-400 font-medium">
                      {b.total_amount?.toLocaleString("vi-VN")}₫
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-lg text-xs font-medium ${statusColors[b.status] || ""}`}>
                        {statusLabels[b.status] || b.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {(b.status === "pending" || b.status === "confirmed") && (
                          <button
                            onClick={() => handleCheckIn(b.id)}
                            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs"
                          >
                            Check-in
                          </button>
                        )}
                        {b.status === "checked_in" && (
                          <button
                            onClick={() => handleCheckOut(b.id)}
                            className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs"
                          >
                            Check-out
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
