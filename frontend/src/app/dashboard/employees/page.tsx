"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";

interface Employee {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  role: string;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
}

const ROLE_OPTIONS = [
  { value: "admin", label: "Quản trị viên" },
  { value: "manager", label: "Quản lý" },
  { value: "receptionist", label: "Lễ tân" },
  { value: "housekeeping", label: "Buồng phòng" },
  { value: "kitchen", label: "Bếp" },
  { value: "cashier", label: "Thu ngân" },
];

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-purple-500/15 text-purple-400",
  manager: "bg-blue-500/15 text-blue-400",
  receptionist: "bg-emerald-500/15 text-emerald-400",
  housekeeping: "bg-amber-500/15 text-amber-400",
  kitchen: "bg-orange-500/15 text-orange-400",
  cashier: "bg-teal-500/15 text-teal-400",
};

const EMPTY_FORM = {
  full_name: "",
  email: "",
  password: "",
  role: "receptionist",
  phone: "",
};

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState({ text: "", type: "" });
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [activeFilter, setActiveFilter] = useState("all");
  const [showModal, setShowModal] = useState(false);
  const [editEmployee, setEditEmployee] = useState<Employee | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [confirmToggle, setConfirmToggle] = useState<Employee | null>(null);

  const flash = (text: string, type = "success") => {
    setMsg({ text, type });
    setTimeout(() => setMsg({ text: "", type: "" }), 3500);
  };

  const fetchEmployees = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (roleFilter !== "all") params.set("role", roleFilter);
      if (activeFilter !== "all") params.set("is_active", activeFilter);
      const res = await apiFetch(`/api/employees?${params}`);
      setEmployees(res.data || []);
    } catch (e: any) {
      flash("Lỗi tải danh sách: " + e.message, "error");
    } finally {
      setLoading(false);
    }
  }, [roleFilter, activeFilter]);

  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);

  const openAdd = () => {
    setEditEmployee(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  };

  const openEdit = (emp: Employee) => {
    setEditEmployee(emp);
    setForm({
      full_name: emp.full_name,
      email: emp.email,
      password: "",
      role: emp.role,
      phone: emp.phone || "",
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.full_name.trim()) { flash("Vui lòng nhập họ tên", "error"); return; }
    if (!editEmployee && !form.email.trim()) { flash("Vui lòng nhập email", "error"); return; }
    if (!editEmployee && !form.password.trim()) { flash("Vui lòng nhập mật khẩu", "error"); return; }

    setSaving(true);
    try {
      if (editEmployee) {
        const payload: any = { full_name: form.full_name, role: form.role };
        if (form.phone) payload.phone = form.phone;
        await apiFetch(`/api/employees/${editEmployee.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        flash("✅ Cập nhật nhân viên thành công");
      } else {
        const payload: any = {
          full_name: form.full_name,
          email: form.email,
          password: form.password,
          role: form.role,
        };
        if (form.phone) payload.phone = form.phone;
        await apiFetch("/api/employees", { method: "POST", body: JSON.stringify(payload) });
        flash("✅ Thêm nhân viên thành công");
      }
      setShowModal(false);
      fetchEmployees();
    } catch (e: any) {
      flash("❌ " + e.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (emp: Employee) => {
    try {
      await apiFetch(`/api/employees/${emp.id}/toggle-active`, { method: "PATCH" });
      flash(`✅ ${emp.is_active ? "Đã vô hiệu hóa" : "Đã kích hoạt"} tài khoản ${emp.full_name}`);
      setConfirmToggle(null);
      fetchEmployees();
    } catch (e: any) {
      flash("❌ " + e.message, "error");
      setConfirmToggle(null);
    }
  };

  const filtered = employees.filter((e) => {
    const s = search.toLowerCase();
    return !s || e.full_name.toLowerCase().includes(s) || (e.email || "").toLowerCase().includes(s);
  });

  const inputCls = "w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-all text-sm";
  const labelCls = "block text-xs font-medium text-gray-400 mb-1.5";

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">👥 Nhân sự</h1>
          <p className="text-gray-400 text-sm mt-1">Quản lý tài khoản và phân quyền nhân viên</p>
        </div>
        <button
          onClick={openAdd}
          className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-emerald-500/20 hover:scale-[1.02]"
        >
          + Thêm nhân viên
        </button>
      </div>

      {/* Toast */}
      {msg.text && (
        <div className={`fixed top-4 right-4 z-[100] px-5 py-3 rounded-xl border backdrop-blur-xl text-sm shadow-2xl transition-all ${
          msg.type === "error"
            ? "bg-red-900/80 border-red-500/30 text-red-200"
            : "bg-gray-800/90 border-white/10 text-white"
        }`}>
          {msg.text}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="🔍 Tìm theo tên, email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50 text-sm"
        />
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500/50"
        >
          <option value="all">Tất cả vai trò</option>
          {ROLE_OPTIONS.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
        <select
          value={activeFilter}
          onChange={(e) => setActiveFilter(e.target.value)}
          className="px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500/50"
        >
          <option value="all">Tất cả trạng thái</option>
          <option value="true">Đang hoạt động</option>
          <option value="false">Đã vô hiệu hóa</option>
        </select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Tổng nhân viên", value: employees.length, icon: "👥", color: "text-white" },
          { label: "Đang hoạt động", value: employees.filter(e => e.is_active).length, icon: "✅", color: "text-emerald-400" },
          { label: "Vô hiệu hóa", value: employees.filter(e => !e.is_active).length, icon: "⛔", color: "text-red-400" },
          { label: "Vai trò khác nhau", value: new Set(employees.map(e => e.role)).size, icon: "🎭", color: "text-blue-400" },
        ].map((s) => (
          <div key={s.label} className="p-4 rounded-xl border border-white/8 bg-white/3">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-gray-400">{s.label}</p>
              <span className="text-base">{s.icon}</span>
            </div>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 rounded-xl bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p className="text-4xl mb-3">👥</p>
          <p>Không tìm thấy nhân viên nào</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/8 overflow-hidden bg-white/2">
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/8 bg-white/3">
                  <th className="text-left px-5 py-3 text-xs text-gray-400 font-medium">Nhân viên</th>
                  <th className="text-left px-5 py-3 text-xs text-gray-400 font-medium">Email</th>
                  <th className="text-left px-5 py-3 text-xs text-gray-400 font-medium">SĐT</th>
                  <th className="text-left px-5 py-3 text-xs text-gray-400 font-medium">Vai trò</th>
                  <th className="text-left px-5 py-3 text-xs text-gray-400 font-medium">Trạng thái</th>
                  <th className="text-right px-5 py-3 text-xs text-gray-400 font-medium">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((emp) => (
                  <tr key={emp.id} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                          {emp.full_name[0]?.toUpperCase()}
                        </div>
                        <span className="font-medium text-white">{emp.full_name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-gray-300">{emp.email || "—"}</td>
                    <td className="px-5 py-4 text-gray-300">{emp.phone || "—"}</td>
                    <td className="px-5 py-4">
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${ROLE_COLORS[emp.role] || "bg-gray-500/15 text-gray-400"}`}>
                        {ROLE_OPTIONS.find(r => r.value === emp.role)?.label || emp.role}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${emp.is_active ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>
                        {emp.is_active ? "Hoạt động" : "Vô hiệu"}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEdit(emp)}
                          className="px-3 py-1.5 text-xs text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-all"
                        >
                          ✏️ Sửa
                        </button>
                        <button
                          onClick={() => setConfirmToggle(emp)}
                          className={`px-3 py-1.5 text-xs rounded-lg transition-all ${
                            emp.is_active
                              ? "text-gray-400 hover:text-amber-400 bg-white/5 hover:bg-amber-500/10"
                              : "text-gray-400 hover:text-emerald-400 bg-white/5 hover:bg-emerald-500/10"
                          }`}
                        >
                          {emp.is_active ? "⛔ Vô hiệu" : "✅ Kích hoạt"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden divide-y divide-white/5">
            {filtered.map((emp) => (
              <div key={emp.id} className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold">
                      {emp.full_name[0]?.toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-white">{emp.full_name}</p>
                      <p className="text-xs text-gray-400">{emp.email}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs ${emp.is_active ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>
                    {emp.is_active ? "Hoạt động" : "Vô hiệu"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${ROLE_COLORS[emp.role] || "bg-gray-500/15 text-gray-400"}`}>
                    {ROLE_OPTIONS.find(r => r.value === emp.role)?.label || emp.role}
                  </span>
                  <div className="flex gap-2">
                    <button onClick={() => openEdit(emp)} className="px-3 py-1.5 text-xs text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-all">
                      ✏️ Sửa
                    </button>
                    <button
                      onClick={() => setConfirmToggle(emp)}
                      className="px-3 py-1.5 text-xs text-gray-400 hover:text-amber-400 bg-white/5 hover:bg-amber-500/10 rounded-lg transition-all"
                    >
                      {emp.is_active ? "⛔" : "✅"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== ADD/EDIT MODAL ===== */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md p-6 space-y-4 rounded-2xl" style={{ background: "rgba(15,15,25,0.97)", border: "1px solid rgba(255,255,255,0.1)" }}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">
                {editEmployee ? "✏️ Sửa nhân viên" : "➕ Thêm nhân viên"}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white text-xl">✕</button>
            </div>

            <div className="space-y-4">
              <div>
                <label className={labelCls}>Họ và tên *</label>
                <input className={inputCls} value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="Nguyễn Văn A" />
              </div>

              {!editEmployee && (
                <>
                  <div>
                    <label className={labelCls}>Email *</label>
                    <input className={inputCls} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="nhanvien@resort.com" />
                  </div>
                  <div>
                    <label className={labelCls}>Mật khẩu *</label>
                    <input className={inputCls} type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Tối thiểu 6 ký tự" />
                  </div>
                </>
              )}

              <div>
                <label className={labelCls}>Vai trò</label>
                <select className={inputCls} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className={labelCls}>Số điện thoại</label>
                <input className={inputCls} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="0901 234 567" />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowModal(false)} className="px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm text-gray-300">Hủy</button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition-all"
              >
                {saving ? "Đang lưu..." : "💾 Lưu"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== CONFIRM TOGGLE MODAL ===== */}
      {confirmToggle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm p-6 space-y-4 rounded-2xl" style={{ background: "rgba(15,15,25,0.97)", border: "1px solid rgba(255,255,255,0.1)" }}>
            <h3 className="text-lg font-bold text-white">
              {confirmToggle.is_active ? "⛔ Vô hiệu hóa tài khoản" : "✅ Kích hoạt tài khoản"}
            </h3>
            <p className="text-gray-400 text-sm">
              {confirmToggle.is_active
                ? `Tài khoản của ${confirmToggle.full_name} sẽ không thể đăng nhập nữa.`
                : `Tài khoản của ${confirmToggle.full_name} sẽ được kích hoạt trở lại.`}
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmToggle(null)} className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-sm text-gray-300">Hủy</button>
              <button
                onClick={() => handleToggleActive(confirmToggle)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all ${confirmToggle.is_active ? "bg-amber-600 hover:bg-amber-500" : "bg-emerald-600 hover:bg-emerald-500"}`}
              >
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
