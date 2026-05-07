"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";

interface Room {
  id: string;
  room_number: string;
  floor: number;
  status: string;
  notes: string | null;
  room_types: { name: string } | null;
}

interface HousekeepingStats {
  total: number;
  cleaning: number;
  maintenance: number;
  available: number;
  occupied: number;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; icon: string; border: string }
> = {
  cleaning: {
    label: "Cần dọn",
    color: "text-amber-400",
    bg: "bg-amber-500/15",
    icon: "🧹",
    border: "border-amber-500/30",
  },
  maintenance: {
    label: "Bảo trì",
    color: "text-red-400",
    bg: "bg-red-500/15",
    icon: "🔧",
    border: "border-red-500/30",
  },
  occupied: {
    label: "Có khách",
    color: "text-blue-400",
    bg: "bg-blue-500/15",
    icon: "🔑",
    border: "border-blue-500/30",
  },
  available: {
    label: "Sẵn sàng",
    color: "text-emerald-400",
    bg: "bg-emerald-500/15",
    icon: "✅",
    border: "border-emerald-500/30",
  },
  out_of_service: {
    label: "Ngừng HĐ",
    color: "text-gray-400",
    bg: "bg-gray-500/15",
    icon: "⛔",
    border: "border-gray-500/30",
  },
};

export default function HousekeepingPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [stats, setStats] = useState<HousekeepingStats>({
    total: 0,
    cleaning: 0,
    maintenance: 0,
    available: 0,
    occupied: 0,
  });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [floorFilter, setFloorFilter] = useState<number | "all">("all");
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [noteText, setNoteText] = useState("");

  const fetchRooms = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filter !== "all") params.set("status", filter);
      if (floorFilter !== "all") params.set("floor", String(floorFilter));
      const result = await apiFetch(
        `/api/housekeeping/rooms?${params.toString()}`
      );
      setRooms(result.data);
      if (result.stats) setStats(result.stats);
    } catch (err) {
      console.error("Lỗi tải danh sách phòng:", err);
    } finally {
      setLoading(false);
    }
  }, [filter, floorFilter]);

  useEffect(() => {
    fetchRooms();
    // Auto-refresh mỗi 30s
    const interval = setInterval(fetchRooms, 30000);
    return () => clearInterval(interval);
  }, [fetchRooms]);

  const handleStatusUpdate = async (roomId: string, newStatus: string) => {
    setActionLoading(true);
    try {
      const body: any = { status: newStatus };
      if (noteText.trim()) body.notes = noteText.trim();

      await apiFetch(`/api/housekeeping/rooms/${roomId}/status`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      setSelectedRoom(null);
      setNoteText("");
      fetchRooms();
    } catch (err: any) {
      alert("Lỗi: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Lấy danh sách tầng
  const floors = [...new Set(rooms.map((r) => r.floor))].sort(
    (a, b) => a - b
  );

  const cleaningRooms = rooms.filter((r) => r.status === "cleaning");

  return (
    <div className="p-4 md:p-6 space-y-5 animate-fade-in max-w-3xl mx-auto">
      {/* Header – Mobile friendly */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white flex items-center gap-2">
            🧹 Buồng phòng
          </h1>
          <p className="text-gray-400 text-xs md:text-sm mt-1">
            Nhận và hoàn thành yêu cầu dọn phòng
          </p>
        </div>
        <button
          onClick={() => {
            setLoading(true);
            fetchRooms();
          }}
          className="p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-gray-400 hover:text-white transition-all active:scale-95"
        >
          🔄
        </button>
      </div>

      {/* Quick Stats – Bố cục ngang, cuộn trên mobile */}
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0 stagger-children">
        {[
          {
            label: "Cần dọn",
            value: stats.cleaning,
            color: "text-amber-400",
            bg: "bg-amber-500/10 border-amber-500/20",
            icon: "🧹",
            pulse: stats.cleaning > 0,
          },
          {
            label: "Bảo trì",
            value: stats.maintenance,
            color: "text-red-400",
            bg: "bg-red-500/10 border-red-500/20",
            icon: "🔧",
            pulse: false,
          },
          {
            label: "Sẵn sàng",
            value: stats.available,
            color: "text-emerald-400",
            bg: "bg-emerald-500/10 border-emerald-500/20",
            icon: "✅",
            pulse: false,
          },
          {
            label: "Có khách",
            value: stats.occupied,
            color: "text-blue-400",
            bg: "bg-blue-500/10 border-blue-500/20",
            icon: "🔑",
            pulse: false,
          },
        ].map((s) => (
          <div
            key={s.label}
            className={`flex-shrink-0 w-[130px] md:flex-1 p-3 rounded-xl border ${s.bg} ${
              s.pulse ? "pulse-glow" : ""
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-400">{s.label}</span>
              <span>{s.icon}</span>
            </div>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Phòng cần dọn – Ưu tiên cao nhất */}
      {cleaningRooms.length > 0 && filter === "all" && (
        <div className="animate-slide-up">
          <h2 className="text-sm font-semibold text-amber-400 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            Phòng cần dọn ngay ({cleaningRooms.length})
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {cleaningRooms.map((room) => (
              <button
                key={room.id}
                onClick={() => {
                  setSelectedRoom(room);
                  setNoteText(room.notes || "");
                }}
                className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/25 text-left active:scale-[0.97] transition-all hover:bg-amber-500/15"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-lg font-bold text-white">
                    {room.room_number}
                  </span>
                  <span className="text-xl">🧹</span>
                </div>
                <p className="text-xs text-gray-400 truncate">
                  {room.room_types?.name || "—"}
                </p>
                <p className="text-xs text-amber-400 font-medium mt-1">
                  Cần dọn
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Bộ lọc – Cuộn ngang trên mobile */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0">
        {[
          { value: "all", label: "Tất cả" },
          { value: "cleaning", label: "🧹 Cần dọn" },
          { value: "maintenance", label: "🔧 Bảo trì" },
          { value: "available", label: "✅ Sẵn sàng" },
          { value: "occupied", label: "🔑 Có khách" },
        ].map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`flex-shrink-0 px-4 py-2 rounded-xl text-xs md:text-sm font-medium border transition-all active:scale-95 ${
              filter === f.value
                ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                : "bg-white/5 border-white/10 text-gray-400"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Floor filter */}
      {floors.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setFloorFilter("all")}
            className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              floorFilter === "all"
                ? "bg-white/10 border-white/20 text-white"
                : "bg-white/5 border-white/5 text-gray-500"
            }`}
          >
            Tất cả tầng
          </button>
          {floors.map((f) => (
            <button
              key={f}
              onClick={() => setFloorFilter(f)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                floorFilter === f
                  ? "bg-white/10 border-white/20 text-white"
                  : "bg-white/5 border-white/5 text-gray-500"
              }`}
            >
              {f === 0 ? "Villa" : `T${f}`}
            </button>
          ))}
        </div>
      )}

      {/* Danh sách tất cả phòng */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="skeleton h-16 w-full" />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {rooms.length === 0 ? (
            <div className="text-center py-12 text-gray-500 text-sm">
              Không có phòng nào
            </div>
          ) : (
            rooms.map((room) => {
              const cfg =
                STATUS_CONFIG[room.status] || STATUS_CONFIG.available;
              return (
                <button
                  key={room.id}
                  onClick={() => {
                    setSelectedRoom(room);
                    setNoteText(room.notes || "");
                  }}
                  className={`w-full flex items-center gap-4 p-4 rounded-xl border text-left transition-all active:scale-[0.98] hover:bg-white/[0.03] ${cfg.border} ${cfg.bg}`}
                >
                  {/* Room Number */}
                  <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-white/5 flex items-center justify-center">
                    <span className="text-lg font-bold text-white">
                      {room.room_number}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white">
                        {room.room_types?.name || "—"}
                      </span>
                      <span className="text-xs text-gray-500">
                        {room.floor === 0
                          ? "Villa"
                          : `Tầng ${room.floor}`}
                      </span>
                    </div>
                    {room.notes && (
                      <p className="text-xs text-gray-500 truncate mt-0.5">
                        📝 {room.notes}
                      </p>
                    )}
                  </div>

                  {/* Status badge */}
                  <div className="flex-shrink-0 flex items-center gap-1.5">
                    <span className="text-lg">{cfg.icon}</span>
                    <span
                      className={`text-xs font-medium ${cfg.color} hidden md:inline`}
                    >
                      {cfg.label}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}

      {/* ===== ACTION MODAL – Mobile Bottom Sheet style ===== */}
      {selectedRoom && (
        <div
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setSelectedRoom(null);
              setNoteText("");
            }
          }}
        >
          <div className="glass-card w-full md:max-w-md md:mx-4 rounded-t-3xl md:rounded-2xl p-6 space-y-4 animate-slide-up">
            {/* Drag indicator (mobile) */}
            <div className="w-10 h-1 bg-white/20 rounded-full mx-auto md:hidden" />

            {/* Room Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-600/20 flex items-center justify-center border border-emerald-500/20">
                  <span className="text-lg font-bold text-white">
                    {selectedRoom.room_number}
                  </span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">
                    Phòng {selectedRoom.room_number}
                  </h3>
                  <p className="text-xs text-gray-400">
                    {selectedRoom.room_types?.name || "—"} •{" "}
                    {selectedRoom.floor === 0
                      ? "Villa"
                      : `Tầng ${selectedRoom.floor}`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setSelectedRoom(null);
                  setNoteText("");
                }}
                className="p-2 text-gray-400 hover:text-white rounded-xl hover:bg-white/5 hidden md:block"
              >
                ✕
              </button>
            </div>

            {/* Trạng thái hiện tại */}
            <div className="flex items-center gap-2 px-3 py-2 bg-white/5 rounded-xl">
              <span className="text-sm text-gray-400">Trạng thái:</span>
              <span
                className={`text-sm font-medium ${
                  STATUS_CONFIG[selectedRoom.status]?.color || "text-gray-400"
                }`}
              >
                {STATUS_CONFIG[selectedRoom.status]?.icon}{" "}
                {STATUS_CONFIG[selectedRoom.status]?.label}
              </span>
            </div>

            {/* Ghi chú */}
            <div>
              <label className="text-xs text-gray-400 mb-1.5 block">
                Ghi chú
              </label>
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Ghi chú cho phòng này..."
                rows={2}
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500/50 resize-none"
              />
            </div>

            {/* Thao tác nhanh – Nút lớn cho mobile */}
            <div className="space-y-2">
              <p className="text-xs text-gray-400 uppercase tracking-wide">
                Thao tác
              </p>

              {selectedRoom.status === "cleaning" && (
                <button
                  onClick={() =>
                    handleStatusUpdate(selectedRoom.id, "available")
                  }
                  disabled={actionLoading}
                  className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-50 shadow-lg shadow-emerald-500/20"
                >
                  {actionLoading
                    ? "⏳ Đang xử lý..."
                    : "✅ Hoàn tất dọn phòng"}
                </button>
              )}

              {selectedRoom.status === "maintenance" && (
                <button
                  onClick={() =>
                    handleStatusUpdate(selectedRoom.id, "available")
                  }
                  disabled={actionLoading}
                  className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  {actionLoading
                    ? "⏳ Đang xử lý..."
                    : "✅ Hoàn tất bảo trì"}
                </button>
              )}

              {selectedRoom.status === "available" && (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() =>
                      handleStatusUpdate(selectedRoom.id, "cleaning")
                    }
                    disabled={actionLoading}
                    className="py-3 bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/30 text-amber-400 rounded-xl text-sm font-medium transition-all active:scale-[0.97] disabled:opacity-50"
                  >
                    🧹 Đánh dấu dọn
                  </button>
                  <button
                    onClick={() =>
                      handleStatusUpdate(selectedRoom.id, "maintenance")
                    }
                    disabled={actionLoading}
                    className="py-3 bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-400 rounded-xl text-sm font-medium transition-all active:scale-[0.97] disabled:opacity-50"
                  >
                    🔧 Bảo trì
                  </button>
                </div>
              )}

              {selectedRoom.status === "occupied" && (
                <p className="text-xs text-gray-500 text-center py-2">
                  Phòng đang có khách – chờ check-out để dọn
                </p>
              )}
            </div>

            {/* Close button (mobile) */}
            <button
              onClick={() => {
                setSelectedRoom(null);
                setNoteText("");
              }}
              className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 rounded-xl text-sm font-medium transition-all md:hidden"
            >
              Đóng
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
