"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";

interface PayrollRecord {
  id: string;
  user_id: string;
  month: number;
  year: number;
  base_salary: number;
  total_work_days: number;
  total_overtime_hours: number;
  overtime_pay: number;
  bonus: number;
  deductions: number;
  net_salary: number;
  status: string;
  notes: string | null;
  users: { full_name: string; role: string } | null;
}

interface UserOption {
  id: string;
  full_name: string;
  role: string;
}

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: "Nháp", color: "text-gray-400", bg: "bg-gray-500/15" },
  confirmed: { label: "Đã duyệt", color: "text-blue-400", bg: "bg-blue-500/15" },
  paid: { label: "Đã trả", color: "text-emerald-400", bg: "bg-emerald-500/15" },
};

const ROLE_LABELS: Record<string, string> = {
  admin: "Quản trị",
  manager: "Quản lý",
  receptionist: "Lễ tân",
  customer: "Khách hàng",
  ke_toan: "Kế toán",
  housekeeping: "Buồng phòng",
  kitchen: "Bếp",
  cashier: "Thu ngân",
};

export default function PayrollPage() {
  const [records, setRecords] = useState<PayrollRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [monthFilter, setMonthFilter] = useState(new Date().getMonth() + 1);
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear());
  const [statusFilter, setStatusFilter] = useState("all");

  // Calculate modal
  const [showCalcModal, setShowCalcModal] = useState(false);
  const [calcLoading, setCalcLoading] = useState(false);
  const [calcForm, setCalcForm] = useState({
    user_id: "",
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    base_salary: 0,
    bonus: 0,
    deductions: 0,
    notes: "",
  });

  // Detail modal
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailData, setDetailData] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchPayroll = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        month: String(monthFilter),
        year: String(yearFilter),
      });
      if (statusFilter !== "all") params.set("status", statusFilter);
      const result = await apiFetch(`/api/payroll?${params}`);
      setRecords(result.data);
    } catch (err) {
      console.error("Lỗi tải bảng lương:", err);
    } finally {
      setLoading(false);
    }
  }, [monthFilter, yearFilter, statusFilter]);

  useEffect(() => {
    fetchPayroll();
  }, [fetchPayroll]);

  const handleCalculate = async () => {
    if (!calcForm.user_id) {
      alert("Vui lòng nhập User ID");
      return;
    }
    setCalcLoading(true);
    try {
      const result = await apiFetch("/api/payroll/calculate", {
        method: "POST",
        body: JSON.stringify(calcForm),
      });
      alert(result.message || "Tính lương thành công");
      setShowCalcModal(false);
      fetchPayroll();
    } catch (err: any) {
      alert("Lỗi: " + err.message);
    } finally {
      setCalcLoading(false);
    }
  };

  const handleViewDetail = async (record: PayrollRecord) => {
    setShowDetailModal(true);
    setDetailLoading(true);
    try {
      const result = await apiFetch(
        `/api/payroll/summary/${record.user_id}/${record.year}/${record.month}`
      );
      setDetailData(result);
    } catch (err) {
      console.error("Lỗi tải chi tiết:", err);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleStatusUpdate = async (payrollId: string, newStatus: string) => {
    try {
      await apiFetch(`/api/payroll/${payrollId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      fetchPayroll();
    } catch (err: any) {
      alert("Lỗi: " + err.message);
    }
  };

  const formatMoney = (n: number) =>
    n.toLocaleString("vi-VN", { style: "currency", currency: "VND" });

  // Thống kê
  const stats = {
    total: records.length,
    totalNet: records.reduce((sum, r) => sum + (r.net_salary || 0), 0),
    draft: records.filter((r) => r.status === "draft").length,
    confirmed: records.filter((r) => r.status === "confirmed").length,
    paid: records.filter((r) => r.status === "paid").length,
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">💰 Bảng lương</h1>
          <p className="text-gray-400 text-sm mt-1">
            Quản lý và tính toán lương nhân viên
          </p>
        </div>
        <button
          onClick={() => setShowCalcModal(true)}
          className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-sm font-semibold transition-all hover:scale-[1.02] shadow-lg shadow-emerald-500/20"
        >
          🧮 Tính lương
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 stagger-children">
        <div className="stat-card p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide">
            Tổng NV
          </p>
          <p className="text-3xl font-bold text-white mt-1">{stats.total}</p>
        </div>
        <div className="stat-card p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide">
            Tổng lương
          </p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">
            {formatMoney(stats.totalNet)}
          </p>
        </div>
        <div className="stat-card p-4">
          <div className="flex gap-4">
            <div>
              <p className="text-xs text-gray-400">Nháp</p>
              <p className="text-xl font-bold text-gray-400">{stats.draft}</p>
            </div>
            <div>
              <p className="text-xs text-blue-400">Duyệt</p>
              <p className="text-xl font-bold text-blue-400">
                {stats.confirmed}
              </p>
            </div>
          </div>
        </div>
        <div className="stat-card p-4">
          <p className="text-xs text-gray-400 uppercase tracking-wide">
            Đã trả
          </p>
          <p className="text-3xl font-bold text-emerald-400 mt-1">
            {stats.paid}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-center">
        <select
          value={monthFilter}
          onChange={(e) => setMonthFilter(Number(e.target.value))}
          className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500/50"
        >
          {Array.from({ length: 12 }, (_, i) => (
            <option key={i + 1} value={i + 1}>
              Tháng {i + 1}
            </option>
          ))}
        </select>
        <select
          value={yearFilter}
          onChange={(e) => setYearFilter(Number(e.target.value))}
          className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500/50"
        >
          {Array.from({ length: 5 }, (_, i) => {
            const y = new Date().getFullYear() - 2 + i;
            return (
              <option key={y} value={y}>
                {y}
              </option>
            );
          })}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500/50"
        >
          <option value="all">Tất cả trạng thái</option>
          <option value="draft">Nháp</option>
          <option value="confirmed">Đã duyệt</option>
          <option value="paid">Đã trả</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="skeleton h-14 w-full" />
          ))}
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <div className="max-h-[60vh] overflow-y-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nhân viên</th>
                  <th>Vai trò</th>
                  <th className="text-right">Lương cơ bản</th>
                  <th className="text-center">Ngày công</th>
                  <th className="text-right">OT</th>
                  <th className="text-right">Thưởng</th>
                  <th className="text-right">Khấu trừ</th>
                  <th className="text-right">Thực lĩnh</th>
                  <th className="text-center">Trạng thái</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {records.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center py-12 text-gray-500">
                      Không có dữ liệu bảng lương
                    </td>
                  </tr>
                ) : (
                  records.map((r) => {
                    const st =
                      STATUS_LABELS[r.status] || STATUS_LABELS.draft;
                    return (
                      <tr key={r.id}>
                        <td className="font-medium text-white">
                          {r.users?.full_name || "—"}
                        </td>
                        <td>
                          {ROLE_LABELS[r.users?.role || ""] ||
                            r.users?.role ||
                            "—"}
                        </td>
                        <td className="text-right font-mono">
                          {formatMoney(r.base_salary)}
                        </td>
                        <td className="text-center">{r.total_work_days}</td>
                        <td className="text-right text-amber-400 font-mono">
                          {formatMoney(r.overtime_pay)}
                        </td>
                        <td className="text-right text-emerald-400 font-mono">
                          {r.bonus > 0 ? `+${formatMoney(r.bonus)}` : "—"}
                        </td>
                        <td className="text-right text-red-400 font-mono">
                          {r.deductions > 0
                            ? `-${formatMoney(r.deductions)}`
                            : "—"}
                        </td>
                        <td className="text-right font-bold text-white font-mono">
                          {formatMoney(r.net_salary)}
                        </td>
                        <td className="text-center">
                          <span
                            className={`px-2.5 py-1 rounded-lg text-xs font-medium ${st.bg} ${st.color}`}
                          >
                            {st.label}
                          </span>
                        </td>
                        <td>
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleViewDetail(r)}
                              className="p-1.5 hover:bg-white/5 rounded-lg text-gray-400 hover:text-white transition-colors"
                              title="Xem chi tiết"
                            >
                              👁️
                            </button>
                            {r.status === "draft" && (
                              <button
                                onClick={() =>
                                  handleStatusUpdate(r.id, "confirmed")
                                }
                                className="p-1.5 hover:bg-blue-500/10 rounded-lg text-gray-400 hover:text-blue-400 transition-colors"
                                title="Duyệt"
                              >
                                ✔️
                              </button>
                            )}
                            {r.status === "confirmed" && (
                              <button
                                onClick={() =>
                                  handleStatusUpdate(r.id, "paid")
                                }
                                className="p-1.5 hover:bg-emerald-500/10 rounded-lg text-gray-400 hover:text-emerald-400 transition-colors"
                                title="Đánh dấu đã trả"
                              >
                                💸
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===== CALCULATE MODAL ===== */}
      {showCalcModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-lg p-6 space-y-5 animate-slide-up">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-white">🧮 Tính lương</h3>
              <button
                onClick={() => setShowCalcModal(false)}
                className="text-gray-400 hover:text-white text-xl"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="text-xs text-gray-400 mb-1 block">
                  User ID *
                </label>
                <input
                  type="text"
                  value={calcForm.user_id}
                  onChange={(e) =>
                    setCalcForm({ ...calcForm, user_id: e.target.value })
                  }
                  placeholder="UUID nhân viên"
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500/50"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">
                  Tháng
                </label>
                <select
                  value={calcForm.month}
                  onChange={(e) =>
                    setCalcForm({
                      ...calcForm,
                      month: Number(e.target.value),
                    })
                  }
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm"
                >
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      Tháng {i + 1}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Năm</label>
                <select
                  value={calcForm.year}
                  onChange={(e) =>
                    setCalcForm({
                      ...calcForm,
                      year: Number(e.target.value),
                    })
                  }
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm"
                >
                  {Array.from({ length: 5 }, (_, i) => {
                    const y = new Date().getFullYear() - 2 + i;
                    return (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    );
                  })}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">
                  Lương cơ bản (₫)
                </label>
                <input
                  type="number"
                  value={calcForm.base_salary}
                  onChange={(e) =>
                    setCalcForm({
                      ...calcForm,
                      base_salary: Number(e.target.value),
                    })
                  }
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500/50"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">
                  Thưởng (₫)
                </label>
                <input
                  type="number"
                  value={calcForm.bonus}
                  onChange={(e) =>
                    setCalcForm({
                      ...calcForm,
                      bonus: Number(e.target.value),
                    })
                  }
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500/50"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">
                  Khấu trừ (₫)
                </label>
                <input
                  type="number"
                  value={calcForm.deductions}
                  onChange={(e) =>
                    setCalcForm({
                      ...calcForm,
                      deductions: Number(e.target.value),
                    })
                  }
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500/50"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">
                  Ghi chú
                </label>
                <input
                  type="text"
                  value={calcForm.notes}
                  onChange={(e) =>
                    setCalcForm({ ...calcForm, notes: e.target.value })
                  }
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500/50"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowCalcModal(false)}
                className="flex-1 px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 rounded-xl text-sm font-medium transition-all"
              >
                Hủy
              </button>
              <button
                onClick={handleCalculate}
                disabled={calcLoading}
                className="flex-1 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-sm font-semibold transition-all disabled:opacity-50"
              >
                {calcLoading ? "⏳ Đang tính..." : "🧮 Tính lương"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== DETAIL MODAL ===== */}
      {showDetailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-2xl p-6 space-y-4 animate-slide-up max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-white">
                📋 Chi tiết bảng lương
              </h3>
              <button
                onClick={() => {
                  setShowDetailModal(false);
                  setDetailData(null);
                }}
                className="text-gray-400 hover:text-white text-xl"
              >
                ✕
              </button>
            </div>

            {detailLoading ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="skeleton h-10 w-full" />
                ))}
              </div>
            ) : detailData ? (
              <>
                {/* Payroll info */}
                {detailData.payroll && (
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="bg-white/5 rounded-xl p-3">
                      <p className="text-xs text-gray-400">Nhân viên</p>
                      <p className="text-white font-medium">
                        {detailData.payroll.users?.full_name || "—"}
                      </p>
                    </div>
                    <div className="bg-white/5 rounded-xl p-3">
                      <p className="text-xs text-gray-400">Lương cơ bản</p>
                      <p className="text-white font-medium">
                        {formatMoney(detailData.payroll.base_salary || 0)}
                      </p>
                    </div>
                    <div className="bg-white/5 rounded-xl p-3">
                      <p className="text-xs text-gray-400">Ngày công</p>
                      <p className="text-emerald-400 font-bold">
                        {detailData.payroll.total_work_days}
                      </p>
                    </div>
                    <div className="bg-white/5 rounded-xl p-3">
                      <p className="text-xs text-gray-400">Thực lĩnh</p>
                      <p className="text-emerald-400 font-bold text-lg">
                        {formatMoney(detailData.payroll.net_salary || 0)}
                      </p>
                    </div>
                  </div>
                )}

                {/* Attendance detail */}
                {detailData.attendance_detail?.length > 0 && (
                  <div>
                    <p className="text-sm text-gray-400 mb-2">
                      📅 Chi tiết chấm công ({detailData.attendance_count}{" "}
                      ngày)
                    </p>
                    <div className="max-h-[30vh] overflow-y-auto">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Ngày</th>
                            <th>Ca</th>
                            <th>Trạng thái</th>
                            <th>OT</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detailData.attendance_detail.map(
                            (a: any, i: number) => (
                              <tr key={i}>
                                <td>
                                  {new Date(a.work_date).toLocaleDateString(
                                    "vi-VN"
                                  )}
                                </td>
                                <td>{a.shifts?.name || "—"}</td>
                                <td>
                                  <span
                                    className={`text-xs font-medium ${
                                      a.status === "present"
                                        ? "text-emerald-400"
                                        : a.status === "late"
                                        ? "text-amber-400"
                                        : a.status === "absent"
                                        ? "text-red-400"
                                        : "text-gray-400"
                                    }`}
                                  >
                                    {a.status}
                                  </span>
                                </td>
                                <td className="text-amber-400">
                                  {a.overtime_hours > 0
                                    ? `+${a.overtime_hours}`
                                    : "—"}
                                </td>
                              </tr>
                            )
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="text-gray-500 text-center py-8">
                Không có dữ liệu
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
