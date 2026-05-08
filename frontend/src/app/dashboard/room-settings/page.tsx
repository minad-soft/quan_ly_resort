"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";

interface RoomType {
  id: string;
  name: string;
  description: string | null;
  base_price: number;
  max_occupancy: number;
  amenities: string[];
  is_active: boolean;
}

interface Room {
  id: string;
  room_number: string;
  floor: number | null;
  status: string;
  notes: string | null;
  room_type_id: string | null;
  room_types: { id: string; name: string; base_price: number } | null;
}

const STATUS_COLORS: Record<string, string> = {
  available: "bg-emerald-500/15 text-emerald-400",
  occupied: "bg-red-500/15 text-red-400",
  cleaning: "bg-amber-500/15 text-amber-400",
  maintenance: "bg-blue-500/15 text-blue-400",
  out_of_service: "bg-gray-500/15 text-gray-400",
};
const STATUS_LABELS: Record<string, string> = {
  available: "Trống", occupied: "Có khách",
  cleaning: "Đang dọn", maintenance: "Bảo trì", out_of_service: "Ngưng dùng",
};

const inputCls = "w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50 text-sm";
const labelCls = "block text-xs font-medium text-gray-400 mb-1.5";

export default function RoomSettingsPage() {
  const [tab, setTab] = useState<"types" | "rooms">("types");
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState({ text: "", err: false });

  // Room Type form
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [editType, setEditType] = useState<RoomType | null>(null);
  const [typeForm, setTypeForm] = useState({ name: "", description: "", base_price: 0, max_occupancy: 2, amenities: "" });

  // Room form
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [editRoom, setEditRoom] = useState<Room | null>(null);
  const [roomForm, setRoomForm] = useState({ room_number: "", room_type_id: "", floor: "", notes: "" });

  const flash = (text: string, err = false) => { setMsg({ text, err }); setTimeout(() => setMsg({ text: "", err: false }), 3500); };

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [t, r] = await Promise.all([
        apiFetch("/api/room-settings/room-types"),
        apiFetch("/api/room-settings/rooms"),
      ]);
      setRoomTypes(t.data || []);
      setRooms(r.data || []);
    } catch (e: any) { flash(e.message, true); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ---- Room Types ----
  const openAddType = () => {
    setEditType(null);
    setTypeForm({ name: "", description: "", base_price: 0, max_occupancy: 2, amenities: "" });
    setShowTypeModal(true);
  };
  const openEditType = (t: RoomType) => {
    setEditType(t);
    setTypeForm({ name: t.name, description: t.description || "", base_price: t.base_price, max_occupancy: t.max_occupancy, amenities: (t.amenities || []).join(", ") });
    setShowTypeModal(true);
  };
  const saveType = async () => {
    if (!typeForm.name.trim()) { flash("Vui lòng nhập tên loại phòng", true); return; }
    setSaving(true);
    try {
      const payload = {
        name: typeForm.name,
        description: typeForm.description || null,
        base_price: Number(typeForm.base_price),
        max_occupancy: Number(typeForm.max_occupancy),
        amenities: typeForm.amenities ? typeForm.amenities.split(",").map(s => s.trim()).filter(Boolean) : [],
      };
      if (editType) {
        await apiFetch(`/api/room-settings/room-types/${editType.id}`, { method: "PUT", body: JSON.stringify(payload) });
        flash("✅ Cập nhật loại phòng thành công");
      } else {
        await apiFetch("/api/room-settings/room-types", { method: "POST", body: JSON.stringify(payload) });
        flash("✅ Thêm loại phòng thành công");
      }
      setShowTypeModal(false); fetchAll();
    } catch (e: any) { flash("❌ " + e.message, true); }
    finally { setSaving(false); }
  };
  const deleteType = async (t: RoomType) => {
    if (!confirm(`Xóa loại phòng "${t.name}"?`)) return;
    try {
      await apiFetch(`/api/room-settings/room-types/${t.id}`, { method: "DELETE" });
      flash("✅ Đã xóa loại phòng"); fetchAll();
    } catch (e: any) { flash("❌ " + e.message, true); }
  };

  // ---- Rooms ----
  const openAddRoom = () => {
    setEditRoom(null);
    setRoomForm({ room_number: "", room_type_id: "", floor: "", notes: "" });
    setShowRoomModal(true);
  };
  const openEditRoom = (r: Room) => {
    setEditRoom(r);
    setRoomForm({ room_number: r.room_number, room_type_id: r.room_type_id || "", floor: r.floor?.toString() || "", notes: r.notes || "" });
    setShowRoomModal(true);
  };
  const saveRoom = async () => {
    if (!roomForm.room_number.trim()) { flash("Vui lòng nhập số phòng", true); return; }
    setSaving(true);
    try {
      const payload: any = { room_number: roomForm.room_number };
      if (roomForm.room_type_id) payload.room_type_id = roomForm.room_type_id;
      if (roomForm.floor) payload.floor = Number(roomForm.floor);
      if (roomForm.notes) payload.notes = roomForm.notes;
      if (editRoom) {
        await apiFetch(`/api/room-settings/rooms/${editRoom.id}`, { method: "PUT", body: JSON.stringify(payload) });
        flash("✅ Cập nhật phòng thành công");
      } else {
        await apiFetch("/api/room-settings/rooms", { method: "POST", body: JSON.stringify(payload) });
        flash("✅ Thêm phòng thành công");
      }
      setShowRoomModal(false); fetchAll();
    } catch (e: any) { flash("❌ " + e.message, true); }
    finally { setSaving(false); }
  };
  const deleteRoom = async (r: Room) => {
    if (!confirm(`Xóa phòng ${r.room_number}?`)) return;
    try {
      await apiFetch(`/api/room-settings/rooms/${r.id}`, { method: "DELETE" });
      flash("✅ Đã xóa phòng"); fetchAll();
    } catch (e: any) { flash("❌ " + e.message, true); }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">🛏️ Cài đặt phòng</h1>
          <p className="text-gray-400 text-sm mt-1">Quản lý loại phòng và danh sách phòng</p>
        </div>
        <button
          onClick={tab === "types" ? openAddType : openAddRoom}
          className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-emerald-500/20"
        >
          {tab === "types" ? "+ Thêm loại phòng" : "+ Thêm phòng"}
        </button>
      </div>

      {/* Toast */}
      {msg.text && (
        <div className={`fixed top-4 right-4 z-[100] px-5 py-3 rounded-xl border backdrop-blur-xl text-sm shadow-2xl ${msg.err ? "bg-red-900/80 border-red-500/30 text-red-200" : "bg-gray-800/90 border-white/10 text-white"}`}>
          {msg.text}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2">
        {[{ key: "types" as const, label: "🏷️ Loại phòng", count: roomTypes.length }, { key: "rooms" as const, label: "🚪 Danh sách phòng", count: rooms.length }].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-5 py-2.5 rounded-xl text-sm font-medium border transition-all ${tab === t.key ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400" : "bg-white/5 border-white/10 text-gray-400 hover:text-white"}`}
          >
            {t.label} <span className="ml-1 text-xs opacity-60">({t.count})</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-16 rounded-xl bg-white/5 animate-pulse" />)}</div>
      ) : tab === "types" ? (
        /* ---- ROOM TYPES ---- */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {roomTypes.length === 0 ? (
            <div className="col-span-full text-center py-16 text-gray-500">
              <p className="text-4xl mb-3">🏷️</p><p>Chưa có loại phòng. Bấm "+ Thêm loại phòng" để bắt đầu.</p>
            </div>
          ) : roomTypes.map((t) => (
            <div key={t.id} className="p-5 rounded-2xl border border-white/8 bg-white/3 space-y-3 hover:border-white/15 transition-all">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-white">{t.name}</h3>
                  {t.description && <p className="text-xs text-gray-400 mt-0.5">{t.description}</p>}
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs flex-shrink-0 ${t.is_active ? "bg-emerald-500/15 text-emerald-400" : "bg-gray-500/15 text-gray-400"}`}>
                  {t.is_active ? "Hoạt động" : "Ẩn"}
                </span>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <div><p className="text-xs text-gray-500">Giá cơ bản</p><p className="font-semibold text-emerald-400">{t.base_price.toLocaleString("vi-VN")}đ</p></div>
                <div><p className="text-xs text-gray-500">Sức chứa</p><p className="font-semibold text-white">{t.max_occupancy} người</p></div>
              </div>
              {t.amenities?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {t.amenities.map(a => <span key={a} className="px-2 py-0.5 bg-white/5 rounded-full text-xs text-gray-300">{a}</span>)}
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <button onClick={() => openEditType(t)} className="flex-1 py-1.5 text-xs text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-all">✏️ Sửa</button>
                <button onClick={() => deleteType(t)} className="flex-1 py-1.5 text-xs text-gray-400 hover:text-red-400 bg-white/5 hover:bg-red-500/10 rounded-lg transition-all">🗑️ Xóa</button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* ---- ROOMS ---- */
        <div className="rounded-2xl border border-white/8 overflow-hidden bg-white/2">
          {rooms.length === 0 ? (
            <div className="text-center py-16 text-gray-500"><p className="text-4xl mb-3">🚪</p><p>Chưa có phòng nào.</p></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-white/8 bg-white/3">
                  <th className="text-left px-5 py-3 text-xs text-gray-400">Số phòng</th>
                  <th className="text-left px-5 py-3 text-xs text-gray-400">Tầng</th>
                  <th className="text-left px-5 py-3 text-xs text-gray-400">Loại phòng</th>
                  <th className="text-left px-5 py-3 text-xs text-gray-400">Trạng thái</th>
                  <th className="text-left px-5 py-3 text-xs text-gray-400">Ghi chú</th>
                  <th className="text-right px-5 py-3 text-xs text-gray-400">Thao tác</th>
                </tr></thead>
                <tbody>
                  {rooms.map((r) => (
                    <tr key={r.id} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                      <td className="px-5 py-4 font-semibold text-white">{r.room_number}</td>
                      <td className="px-5 py-4 text-gray-300">{r.floor ? `Tầng ${r.floor}` : "—"}</td>
                      <td className="px-5 py-4 text-gray-300">{r.room_types?.name || "—"}</td>
                      <td className="px-5 py-4">
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${STATUS_COLORS[r.status] || "bg-gray-500/15 text-gray-400"}`}>
                          {STATUS_LABELS[r.status] || r.status}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-gray-400 max-w-[150px] truncate">{r.notes || "—"}</td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => openEditRoom(r)} className="px-3 py-1.5 text-xs text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-all">✏️ Sửa</button>
                          <button onClick={() => deleteRoom(r)} className="px-3 py-1.5 text-xs text-gray-400 hover:text-red-400 bg-white/5 hover:bg-red-500/10 rounded-lg transition-all">🗑️ Xóa</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ---- ROOM TYPE MODAL ---- */}
      {showTypeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md p-6 space-y-4 rounded-2xl" style={{ background: "rgba(15,15,25,0.97)", border: "1px solid rgba(255,255,255,0.1)" }}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">{editType ? "✏️ Sửa loại phòng" : "➕ Thêm loại phòng"}</h3>
              <button onClick={() => setShowTypeModal(false)} className="text-gray-400 hover:text-white text-xl">✕</button>
            </div>
            <div className="space-y-3">
              <div><label className={labelCls}>Tên loại phòng *</label><input className={inputCls} value={typeForm.name} onChange={e => setTypeForm({ ...typeForm, name: e.target.value })} placeholder="VD: Phòng Deluxe" /></div>
              <div><label className={labelCls}>Mô tả</label><input className={inputCls} value={typeForm.description} onChange={e => setTypeForm({ ...typeForm, description: e.target.value })} placeholder="Mô tả ngắn..." /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelCls}>Giá cơ bản (đ/đêm)</label><input className={inputCls} type="number" value={typeForm.base_price} onChange={e => setTypeForm({ ...typeForm, base_price: Number(e.target.value) })} /></div>
                <div><label className={labelCls}>Sức chứa (người)</label><input className={inputCls} type="number" value={typeForm.max_occupancy} onChange={e => setTypeForm({ ...typeForm, max_occupancy: Number(e.target.value) })} /></div>
              </div>
              <div><label className={labelCls}>Tiện ích (phân cách bằng dấu phẩy)</label><input className={inputCls} value={typeForm.amenities} onChange={e => setTypeForm({ ...typeForm, amenities: e.target.value })} placeholder="WiFi, TV, Điều hòa, Hồ bơi..." /></div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowTypeModal(false)} className="px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm text-gray-300">Hủy</button>
              <button onClick={saveType} disabled={saving} className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition-all">
                {saving ? "Đang lưu..." : "💾 Lưu"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---- ROOM MODAL ---- */}
      {showRoomModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md p-6 space-y-4 rounded-2xl" style={{ background: "rgba(15,15,25,0.97)", border: "1px solid rgba(255,255,255,0.1)" }}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">{editRoom ? "✏️ Sửa phòng" : "➕ Thêm phòng"}</h3>
              <button onClick={() => setShowRoomModal(false)} className="text-gray-400 hover:text-white text-xl">✕</button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className={labelCls}>Số phòng *</label><input className={inputCls} value={roomForm.room_number} onChange={e => setRoomForm({ ...roomForm, room_number: e.target.value })} placeholder="101" /></div>
                <div><label className={labelCls}>Tầng</label><input className={inputCls} type="number" value={roomForm.floor} onChange={e => setRoomForm({ ...roomForm, floor: e.target.value })} placeholder="1" /></div>
              </div>
              <div>
                <label className={labelCls}>Loại phòng</label>
                <select className={inputCls} value={roomForm.room_type_id} onChange={e => setRoomForm({ ...roomForm, room_type_id: e.target.value })}>
                  <option value="">-- Chọn loại phòng --</option>
                  {roomTypes.map(t => <option key={t.id} value={t.id}>{t.name} – {t.base_price.toLocaleString("vi-VN")}đ</option>)}
                </select>
              </div>
              <div><label className={labelCls}>Ghi chú</label><input className={inputCls} value={roomForm.notes} onChange={e => setRoomForm({ ...roomForm, notes: e.target.value })} placeholder="Ghi chú về phòng..." /></div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowRoomModal(false)} className="px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm text-gray-300">Hủy</button>
              <button onClick={saveRoom} disabled={saving} className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition-all">
                {saving ? "Đang lưu..." : "💾 Lưu"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
