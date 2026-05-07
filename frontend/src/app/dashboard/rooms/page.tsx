"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";

interface Room {
  id: string;
  room_number: string;
  floor: number;
  status: string;
  notes: string | null;
  room_types: {
    name: string;
    base_price: number;
    max_occupancy: number;
  } | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  available: { label: "Trống", color: "text-emerald-400", bg: "bg-emerald-500/15 border-emerald-500/30", icon: "✅" },
  occupied: { label: "Có khách", color: "text-blue-400", bg: "bg-blue-500/15 border-blue-500/30", icon: "🔑" },
  cleaning: { label: "Đang dọn", color: "text-amber-400", bg: "bg-amber-500/15 border-amber-500/30", icon: "🧹" },
  maintenance: { label: "Bảo trì", color: "text-red-400", bg: "bg-red-500/15 border-red-500/30", icon: "🔧" },
  out_of_service: { label: "Ngừng HĐ", color: "text-gray-400", bg: "bg-gray-500/15 border-gray-500/30", icon: "⛔" },
};

export default function RoomsPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchRooms = useCallback(async () => {
    try {
      const params = filter !== "all" ? `?status=${filter}` : "";
      const result = await apiFetch(`/api/rooms${params}`);
      setRooms(result.data);
    } catch (err) {
      console.error("Failed to fetch rooms:", err);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  const handleStatusChange = async (roomId: string, newStatus: string) => {
    setActionLoading(true);
    try {
      await apiFetch(`/api/rooms/${roomId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      await fetchRooms();
      setSelectedRoom(null);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Group rooms by floor
  const floors = rooms.reduce<Record<number, Room[]>>((acc, room) => {
    const floor = room.floor || 0;
    if (!acc[floor]) acc[floor] = [];
    acc[floor].push(room);
    return acc;
  }, {});

  const sortedFloors = Object.keys(floors)
    .map(Number)
    .sort((a, b) => a - b);

  // Stats
  const stats = {
    total: rooms.length,
    available: rooms.filter((r) => r.status === "available").length,
    occupied: rooms.filter((r) => r.status === "occupied").length,
    cleaning: rooms.filter((r) => r.status === "cleaning").length,
  };

  const floorLabel = (f: number) => (f === 0 ? "Khu Villa" : `Tầng ${f}`);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Sơ đồ phòng</h1>
          <p className="text-gray-400 text-sm mt-1">Quản lý trạng thái phòng real-time</p>
        </div>
        <button
          onClick={() => { setLoading(true); fetchRooms(); }}
          className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm text-gray-300"
        >
          🔄 Làm mới
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Tổng phòng", value: stats.total, color: "text-white" },
          { label: "Phòng trống", value: stats.available, color: "text-emerald-400" },
          { label: "Có khách", value: stats.occupied, color: "text-blue-400" },
          { label: "Đang dọn", value: stats.cleaning, color: "text-amber-400" },
        ].map((s) => (
          <div key={s.label} className="glass-card p-4">
            <p className="text-xs text-gray-400 uppercase tracking-wide">{s.label}</p>
            <p className={`text-3xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {[
          { value: "all", label: "Tất cả" },
          { value: "available", label: "✅ Trống" },
          { value: "occupied", label: "🔑 Có khách" },
          { value: "cleaning", label: "🧹 Đang dọn" },
          { value: "maintenance", label: "🔧 Bảo trì" },
        ].map((f) => (
          <button
            key={f.value}
            onClick={() => { setFilter(f.value); setLoading(true); }}
            className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
              filter === f.value
                ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                : "bg-white/5 border-white/10 text-gray-400 hover:text-white hover:bg-white/10"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Room Grid by Floor */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin h-8 w-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="space-y-8">
          {sortedFloors.map((floor) => (
            <div key={floor}>
              <h2 className="text-lg font-semibold text-gray-300 mb-3">
                {floorLabel(floor)}
                <span className="text-sm text-gray-500 ml-2">
                  ({floors[floor].length} phòng)
                </span>
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {floors[floor]
                  .sort((a, b) => a.room_number.localeCompare(b.room_number))
                  .map((room) => {
                    const cfg = STATUS_CONFIG[room.status] || STATUS_CONFIG.available;
                    return (
                      <button
                        key={room.id}
                        onClick={() => setSelectedRoom(room)}
                        className={`p-4 rounded-xl border text-left hover:scale-[1.02] active:scale-[0.98] transition-all ${cfg.bg}`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-lg font-bold text-white">{room.room_number}</span>
                          <span className="text-lg">{cfg.icon}</span>
                        </div>
                        <p className="text-xs text-gray-400 truncate">
                          {room.room_types?.name || "—"}
                        </p>
                        <p className={`text-xs font-medium mt-1 ${cfg.color}`}>
                          {cfg.label}
                        </p>
                      </button>
                    );
                  })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Room Detail Modal */}
      {selectedRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-white">
                Phòng {selectedRoom.room_number}
              </h3>
              <button
                onClick={() => setSelectedRoom(null)}
                className="text-gray-400 hover:text-white text-xl"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Loại phòng</span>
                <span className="text-white">{selectedRoom.room_types?.name || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Giá/đêm</span>
                <span className="text-emerald-400 font-semibold">
                  {selectedRoom.room_types?.base_price?.toLocaleString("vi-VN")}₫
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Sức chứa</span>
                <span className="text-white">{selectedRoom.room_types?.max_occupancy || "—"} khách</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Trạng thái</span>
                <span className={STATUS_CONFIG[selectedRoom.status]?.color}>
                  {STATUS_CONFIG[selectedRoom.status]?.icon} {STATUS_CONFIG[selectedRoom.status]?.label}
                </span>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="pt-4 border-t border-white/10 space-y-2">
              <p className="text-xs text-gray-400 uppercase tracking-wide">Thao tác nhanh</p>
              <div className="grid grid-cols-2 gap-2">
                {selectedRoom.status === "cleaning" && (
                  <button
                    onClick={() => handleStatusChange(selectedRoom.id, "available")}
                    disabled={actionLoading}
                    className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-medium disabled:opacity-50"
                  >
                    ✅ Dọn xong
                  </button>
                )}
                {selectedRoom.status === "available" && (
                  <button
                    onClick={() => handleStatusChange(selectedRoom.id, "maintenance")}
                    disabled={actionLoading}
                    className="px-3 py-2 bg-red-600/80 hover:bg-red-500 text-white rounded-xl text-sm font-medium disabled:opacity-50"
                  >
                    🔧 Bảo trì
                  </button>
                )}
                {selectedRoom.status === "maintenance" && (
                  <button
                    onClick={() => handleStatusChange(selectedRoom.id, "available")}
                    disabled={actionLoading}
                    className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-medium disabled:opacity-50"
                  >
                    ✅ Hoàn tất BT
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
