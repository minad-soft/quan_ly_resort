"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";

interface AttendanceRecord {
  id: string;
  user_id: string;
  work_date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  status: string;
  overtime_hours: number;
  notes: string | null;
  users: { full_name: string; role: string } | null;
  shifts: { name: string; start_time: string; end_time: string } | null;
}

interface MonthlySummary {
  user_id: string;
  full_name: string;
  role: string;
  total_present: number;
  total_late: number;
  total_absent: number;
  total_half_day: number;
  total_leave: number;
  total_overtime_hours: number;
  total_work_days: number;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  present: {
    label: "Có mặt",
    color: "text-emerald-400",
    bg: "bg-emerald-500/15",
  },
  absent: { label: "Vắng", color: "text-red-400", bg: "bg-red-500/15" },
  late: { label: "Đi trễ", color: "text-amber-400", bg: "bg-amber-500/15" },
  half_day: {
    label: "Nửa ngày",
    color: "text-blue-400",
    bg: "bg-blue-500/15",
  },
  leave: {
    label: "Nghỉ phép",
    color: "text-purple-400",
    bg: "bg-purple-500/15",
  },
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

export default function AttendancePage() {
  const [tab, setTab] = useState<"daily" | "monthly">("daily");
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [summary, setSummary] = useState<MonthlySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [monthFilter, setMonthFilter] = useState(new Date().getMonth() + 1);
  const [yearFilter, setYearFilter] = useState(new Date().getFullYear());
  const [statusFilter, setStatusFilter] = useState("all");
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);

  const fetchDaily = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ work_date: dateFilter });
      if (statusFilter !== "all") params.set("status", statusFilter);
      const result = await apiFetch(`/api/attendance?${params}`);
      setRecords(result.data);
    } catch (err) {
      console.error("Lỗi tải dữ liệu chấm công:", err);
    } finally {
      setLoading(false);
    }
  }, [dateFilter, statusFilter]);

  const fetchMonthly = useCallback(async () => {
    try {
      setLoading(true);
      const result = await apiFetch(
        `/api/attendance/report/monthly?month=${monthFilter}&year=${yearFilter}`
      );
      setSummary(result.summary || []);
    } catch (err) {
      console.error("Lỗi tải báo cáo tháng:", err);
    } finally {
      setLoading(false);
    }
  }, [monthFilter, yearFilter]);

  useEffect(() => {
    if (tab === "daily") fetchDaily();
    else fetchMonthly();
  }, [tab, fetchDaily, fetchMonthly]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const startDate = `${yearFilter}-${String(monthFilter).padStart(2, "0")}-01`;
      const endMonth = monthFilter === 12 ? 1 : monthFilter + 1;
      const endYear = monthFilter === 12 ? yearFilter + 1 : yearFilter;
      const endDate = `${endYear}-${String(endMonth).padStart(2, "0")}-01`;

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/attendance/bulk-export?start_date=${startDate}&end_date=${endDate}`,
        {
          headers: {
            Authorization: `Bearer ${(await (await import("@/lib/supabase")).createClient().auth.getSession()).data.session?.access_token}`,
          },
        }
      );
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `attendance_${startDate}_${endDate}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      alert("Lỗi xuất dữ liệu: " + err.message);
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async (file: File) => {
    setImporting(true);
    setImportResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const supabase = (await import("@/lib/supabase")).createClient();
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/attendance/bulk-import`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: formData,
        }
      );

      const result = await response.json();
      if (!response.ok) throw new Error(result.detail || "Lỗi nhập dữ liệu");
      setImportResult(result);
      fetchDaily();
    } catch (err: any) {
      alert("Lỗi nhập dữ liệu: " + err.message);
    } finally {
      setImporting(false);
    }
  };

  const formatTime = (iso: string | null) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDate = (d: string) => {
    return new Date(d).toLocaleDateString("vi-VN", {
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
    });
  };

  // Thống kê nhanh cho daily view
  const dailyStats = {
    total: records.length,
    present: records.filter((r) => r.status === "present").length,
    late: records.filter((r) => r.status === "late").length,
    absent: records.filter((r) => r.status === "absent").length,
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">⏰ Chấm công</h1>
          <p className="text-gray-400 text-sm mt-1">
            Quản lý chấm công nhân viên
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowImportModal(true)}
            className="px-4 py-2 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-400 rounded-xl text-sm font-medium transition-all hover:scale-[1.02]"
          >
            📥 Nhập CSV
          </button>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="px-4 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-400 rounded-xl text-sm font-medium transition-all hover:scale-[1.02] disabled:opacity-50"
          >
            {exporting ? "⏳ Đang xuất..." : "📤 Xuất CSV"}
          </button>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 bg-white/5 p-1 rounded-xl w-fit">
        <button
          onClick={() => setTab("daily")}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
            tab === "daily"
              ? "bg-emerald-500/20 text-emerald-400 shadow-lg"
              : "text-gray-400 hover:text-white"
          }`}
        >
          📅 Theo ngày
        </button>
        <button
          onClick={() => setTab("monthly")}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
            tab === "monthly"
              ? "bg-emerald-500/20 text-emerald-400 shadow-lg"
              : "text-gray-400 hover:text-white"
          }`}
        >
          📊 Báo cáo tháng
        </button>
      </div>

      {/* ===== DAILY VIEW ===== */}
      {tab === "daily" && (
        <div className="space-y-6 animate-slide-up">
          {/* Filters */}
          <div className="flex gap-3 flex-wrap items-center">
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500/50"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-emerald-500/50"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="present">Có mặt</option>
              <option value="late">Đi trễ</option>
              <option value="absent">Vắng</option>
              <option value="half_day">Nửa ngày</option>
              <option value="leave">Nghỉ phép</option>
            </select>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 stagger-children">
            {[
              {
                label: "Tổng",
                value: dailyStats.total,
                color: "text-white",
                icon: "👥",
              },
              {
                label: "Có mặt",
                value: dailyStats.present,
                color: "text-emerald-400",
                icon: "✅",
              },
              {
                label: "Đi trễ",
                value: dailyStats.late,
                color: "text-amber-400",
                icon: "⚠️",
              },
              {
                label: "Vắng",
                value: dailyStats.absent,
                color: "text-red-400",
                icon: "❌",
              },
            ].map((s) => (
              <div key={s.label} className="stat-card p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-gray-400 uppercase tracking-wide">
                    {s.label}
                  </p>
                  <span className="text-lg">{s.icon}</span>
                </div>
                <p className={`text-3xl font-bold ${s.color}`}>{s.value}</p>
              </div>
            ))}
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
                      <th>Ca</th>
                      <th>Giờ vào</th>
                      <th>Giờ ra</th>
                      <th>Trạng thái</th>
                      <th>OT (giờ)</th>
                      <th>Ghi chú</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="text-center py-12 text-gray-500">
                          Không có dữ liệu chấm công
                        </td>
                      </tr>
                    ) : (
                      records.map((r) => {
                        const cfg =
                          STATUS_CONFIG[r.status] || STATUS_CONFIG.present;
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
                            <td>{r.shifts?.name || "—"}</td>
                            <td className="font-mono text-emerald-400">
                              {formatTime(r.check_in_time)}
                            </td>
                            <td className="font-mono text-blue-400">
                              {formatTime(r.check_out_time)}
                            </td>
                            <td>
                              <span
                                className={`px-2.5 py-1 rounded-lg text-xs font-medium ${cfg.bg} ${cfg.color}`}
                              >
                                {cfg.label}
                              </span>
                            </td>
                            <td className="text-amber-400">
                              {r.overtime_hours > 0
                                ? `+${r.overtime_hours}`
                                : "—"}
                            </td>
                            <td className="max-w-[150px] truncate">
                              {r.notes || "—"}
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
        </div>
      )}

      {/* ===== MONTHLY VIEW ===== */}
      {tab === "monthly" && (
        <div className="space-y-6 animate-slide-up">
          {/* Filters */}
          <div className="flex gap-3 items-center">
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
            <button
              onClick={fetchMonthly}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-medium transition-all"
            >
              🔄 Tải lại
            </button>
          </div>

          {/* Summary Table */}
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
                      <th className="text-center">Có mặt</th>
                      <th className="text-center">Đi trễ</th>
                      <th className="text-center">Vắng</th>
                      <th className="text-center">Nửa ngày</th>
                      <th className="text-center">Nghỉ phép</th>
                      <th className="text-center">Tổng công</th>
                      <th className="text-center">OT (giờ)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="text-center py-12 text-gray-500">
                          Không có dữ liệu báo cáo
                        </td>
                      </tr>
                    ) : (
                      summary.map((s) => (
                        <tr key={s.user_id}>
                          <td className="font-medium text-white">
                            {s.full_name}
                          </td>
                          <td>{ROLE_LABELS[s.role] || s.role}</td>
                          <td className="text-center text-emerald-400 font-semibold">
                            {s.total_present}
                          </td>
                          <td className="text-center text-amber-400">
                            {s.total_late}
                          </td>
                          <td className="text-center text-red-400">
                            {s.total_absent}
                          </td>
                          <td className="text-center text-blue-400">
                            {s.total_half_day}
                          </td>
                          <td className="text-center text-purple-400">
                            {s.total_leave}
                          </td>
                          <td className="text-center font-bold text-white">
                            {s.total_work_days}
                          </td>
                          <td className="text-center text-amber-400">
                            {s.total_overtime_hours > 0
                              ? `+${s.total_overtime_hours}`
                              : "—"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===== IMPORT MODAL ===== */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-lg p-6 space-y-4 animate-slide-up">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold text-white">
                📥 Nhập chấm công từ CSV
              </h3>
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setImportResult(null);
                }}
                className="text-gray-400 hover:text-white text-xl"
              >
                ✕
              </button>
            </div>

            <div className="bg-white/5 rounded-xl p-4 text-sm text-gray-300 space-y-2">
              <p className="font-medium text-white">Định dạng file CSV:</p>
              <code className="block bg-black/30 p-3 rounded-lg text-xs text-emerald-400 overflow-x-auto">
                user_id,work_date,status,shift_id,overtime_hours,notes
              </code>
              <p className="text-gray-400 text-xs">
                Trạng thái hợp lệ: present, absent, late, half_day, leave
              </p>
            </div>

            <label className="block">
              <input
                type="file"
                accept=".csv"
                disabled={importing}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImport(file);
                }}
                className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border file:border-emerald-500/30 file:text-sm file:font-medium file:bg-emerald-500/10 file:text-emerald-400 hover:file:bg-emerald-500/20 file:cursor-pointer file:transition-all"
              />
            </label>

            {importing && (
              <div className="flex items-center gap-2 text-sm text-amber-400">
                <div className="animate-spin h-4 w-4 border-2 border-amber-400 border-t-transparent rounded-full" />
                Đang nhập dữ liệu...
              </div>
            )}

            {importResult && (
              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 text-sm">
                <p className="text-emerald-400 font-medium">
                  ✅ {importResult.message}
                </p>
                {importResult.errors?.length > 0 && (
                  <div className="mt-2 text-amber-400 text-xs space-y-1">
                    <p className="font-medium">⚠️ Lỗi:</p>
                    {importResult.errors.map((e: string, i: number) => (
                      <p key={i}>• {e}</p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
