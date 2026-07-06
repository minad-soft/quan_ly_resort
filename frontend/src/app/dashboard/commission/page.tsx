"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { apiFetch } from "@/lib/api";

/* ───── Types ───── */
interface CommissionTicket {
  id: string;
  code: string;
  driver_name: string;
  driver_phone: string | null;
  amount: number;
  status: "pending" | "paid" | "expired";
  created_at: string;
  paid_at: string | null;
  payment_method: string | null;
  menu_item_name?: string;
  order_id?: string;
}

/* ───── Page ───── */
export default function CommissionPage() {
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState<CommissionTicket[]>([]);
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "paid">("all");

  // Scanner
  const [scanCode, setScanCode] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scannedTicket, setScannedTicket] = useState<CommissionTicket | null>(null);
  const [scanError, setScanError] = useState("");
  const scanRef = useRef<HTMLInputElement>(null);

  // Payment
  const [payMethod, setPayMethod] = useState<"cash" | "transfer">("cash");
  const [paying, setPaying] = useState(false);

  // Toast
  const [msg, setMsg] = useState("");
  const flash = (m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(""), 3000);
  };

  /* ───── Auto-focus scanner ───── */
  useEffect(() => {
    scanRef.current?.focus();
  }, []);

  /* ───── Fetch today tickets ───── */
  const fetchTickets = useCallback(async () => {
    try {
      const res = await apiFetch("/api/commission/tickets");
      setTickets(res.data || []);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    fetchTickets().finally(() => setLoading(false));
  }, [fetchTickets]);

  /* ───── Scan / Search ───── */
  const handleScan = async () => {
    const code = scanCode.trim();
    if (!code) return;
    setScanning(true);
    setScanError("");
    setScannedTicket(null);
    try {
      const res = await apiFetch(`/api/commission/tickets/scan/${encodeURIComponent(code)}`);
      setScannedTicket(res.data);
      setPayMethod("cash");
    } catch (e: any) {
      setScanError(e.message || "Không tìm thấy vé");
      setScannedTicket(null);
    } finally {
      setScanning(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleScan();
    }
  };

  /* ───── Pay ───── */
  const handlePay = async () => {
    if (!scannedTicket) return;
    setPaying(true);
    try {
      await apiFetch(`/api/commission/tickets/${scannedTicket.id}/pay`, {
        method: "POST",
        body: JSON.stringify({ payment_method: payMethod }),
      });
      flash("✅ Đã chi hoa hồng thành công!");
      // Refresh ticket
      const res = await apiFetch(
        `/api/commission/tickets/scan/${encodeURIComponent(scannedTicket.code)}`
      );
      setScannedTicket(res.data);
      await fetchTickets();
      // Reset scanner for next scan
      setScanCode("");
      scanRef.current?.focus();
    } catch (e: any) {
      flash("❌ " + e.message);
    } finally {
      setPaying(false);
    }
  };

  /* ───── Helpers ───── */
  const formatPrice = (v: number) =>
    new Intl.NumberFormat("vi-VN").format(v) + "đ";

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const isExpired = (ticket: CommissionTicket) => {
    if (ticket.status === "expired") return true;
    const created = new Date(ticket.created_at);
    const today = new Date();
    return (
      created.toDateString() !== today.toDateString() &&
      ticket.status === "pending"
    );
  };

  const statusBadge = (ticket: CommissionTicket) => {
    if (ticket.status === "paid")
      return (
        <span className="px-3 py-1 bg-red-500/20 text-red-400 rounded-full text-xs font-medium">
          Đã chi
        </span>
      );
    if (isExpired(ticket))
      return (
        <span className="px-3 py-1 bg-orange-500/20 text-orange-400 rounded-full text-xs font-medium">
          Hết hạn
        </span>
      );
    return (
      <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-xs font-medium">
        Chờ chi
      </span>
    );
  };

  const filteredTickets = tickets.filter((t) => {
    if (statusFilter === "all") return true;
    if (statusFilter === "pending") return t.status === "pending" && !isExpired(t);
    return t.status === statusFilter;
  });

  /* ───── Styles ───── */
  const cardCls =
    "bg-gray-900/50 border border-white/10 rounded-2xl backdrop-blur-sm";

  /* ───── Loading ───── */
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Toast */}
      {msg && (
        <div className="fixed top-6 right-6 z-50 px-5 py-3 rounded-xl bg-gray-800/90 border border-white/10 backdrop-blur-xl text-white text-sm shadow-2xl animate-[fadeIn_0.3s_ease]">
          {msg}
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">🏧 Chi Hoa Hồng Tài Xế</h1>
        <p className="text-gray-400 text-sm mt-1">
          Quét mã vé hoặc nhập mã để tra cứu & chi hoa hồng
        </p>
      </div>

      {/* ===== Scanner Section ===== */}
      <div className={`${cardCls} p-6`}>
        <h2 className="text-base font-semibold text-white mb-4">
          🔍 Quét / Tìm vé hoa hồng
        </h2>

        <div className="flex gap-3">
          <div className="flex-1 relative">
            <input
              ref={scanRef}
              type="text"
              className="w-full px-5 py-4 bg-white/5 border-2 border-white/10 rounded-xl text-white text-lg placeholder-gray-500 focus:outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 transition-all font-mono tracking-wider"
              placeholder="Nhập hoặc quét mã vé..."
              value={scanCode}
              onChange={(e) => setScanCode(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
            />
            {scanCode && (
              <button
                onClick={() => {
                  setScanCode("");
                  setScannedTicket(null);
                  setScanError("");
                  scanRef.current?.focus();
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
              >
                ✕
              </button>
            )}
          </div>
          <button
            onClick={handleScan}
            disabled={scanning || !scanCode.trim()}
            className="px-8 py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white rounded-xl text-base font-semibold transition-all shadow-lg shadow-emerald-500/20 whitespace-nowrap"
          >
            {scanning ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                Đang tìm...
              </span>
            ) : (
              "🔍 Tìm"
            )}
          </button>
        </div>

        {/* Scan error */}
        {scanError && (
          <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
            <p className="text-sm text-red-400">❌ {scanError}</p>
          </div>
        )}

        {/* ===== Scanned Ticket Result ===== */}
        {scannedTicket && (
          <div className="mt-5 p-5 bg-white/5 border border-white/10 rounded-xl space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">
                  Mã vé
                </p>
                <p className="text-xl font-bold text-white font-mono">
                  {scannedTicket.code}
                </p>
              </div>
              {statusBadge(scannedTicket)}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Tên tài xế</p>
                <p className="text-sm text-white font-medium">
                  {scannedTicket.driver_name}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Số điện thoại</p>
                <p className="text-sm text-white font-medium">
                  {scannedTicket.driver_phone || "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Số tiền</p>
                <p className="text-lg text-emerald-400 font-bold">
                  {formatPrice(scannedTicket.amount)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Thời gian tạo</p>
                <p className="text-sm text-gray-300">
                  {formatTime(scannedTicket.created_at)}
                </p>
              </div>
            </div>

            {scannedTicket.menu_item_name && (
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Dịch vụ</p>
                <p className="text-sm text-gray-300">{scannedTicket.menu_item_name}</p>
              </div>
            )}

            {/* PAID ticket */}
            {scannedTicket.status === "paid" && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                <div className="flex items-center gap-2">
                  <span className="text-red-400 text-lg">🚫</span>
                  <div>
                    <p className="text-sm font-medium text-red-400">
                      Vé đã được chi trả
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Chi lúc: {scannedTicket.paid_at ? formatTime(scannedTicket.paid_at) : "—"}
                      {scannedTicket.payment_method && (
                        <> • {scannedTicket.payment_method === "cash" ? "Tiền mặt" : "Chuyển khoản"}</>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* EXPIRED ticket */}
            {scannedTicket.status === "pending" && isExpired(scannedTicket) && (
              <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-xl">
                <div className="flex items-center gap-2">
                  <span className="text-orange-400 text-lg">⚠️</span>
                  <div>
                    <p className="text-sm font-medium text-orange-400">
                      Vé đã hết hạn (chỉ hiệu lực trong ngày)
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Tạo lúc: {formatTime(scannedTicket.created_at)}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* PENDING ticket - allow payment */}
            {scannedTicket.status === "pending" && !isExpired(scannedTicket) && (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl space-y-4">
                <p className="text-sm font-medium text-emerald-400">
                  ✅ Vé hợp lệ — Chọn phương thức chi trả
                </p>

                <div className="flex gap-3">
                  <button
                    onClick={() => setPayMethod("cash")}
                    className={`flex-1 p-4 rounded-xl border-2 transition-all text-center ${
                      payMethod === "cash"
                        ? "border-emerald-500/50 bg-emerald-500/10"
                        : "border-white/10 bg-white/5 hover:border-white/20"
                    }`}
                  >
                    <span className="text-2xl block mb-1">💵</span>
                    <span
                      className={`text-sm font-medium ${
                        payMethod === "cash"
                          ? "text-emerald-400"
                          : "text-gray-300"
                      }`}
                    >
                      Tiền mặt
                    </span>
                  </button>
                  <button
                    onClick={() => setPayMethod("transfer")}
                    className={`flex-1 p-4 rounded-xl border-2 transition-all text-center ${
                      payMethod === "transfer"
                        ? "border-emerald-500/50 bg-emerald-500/10"
                        : "border-white/10 bg-white/5 hover:border-white/20"
                    }`}
                  >
                    <span className="text-2xl block mb-1">🏦</span>
                    <span
                      className={`text-sm font-medium ${
                        payMethod === "transfer"
                          ? "text-emerald-400"
                          : "text-gray-300"
                      }`}
                    >
                      Chuyển khoản
                    </span>
                  </button>
                </div>

                <button
                  onClick={handlePay}
                  disabled={paying}
                  className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white rounded-xl text-base font-bold transition-all shadow-lg shadow-emerald-500/20"
                >
                  {paying ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                      Đang xử lý...
                    </span>
                  ) : (
                    `💰 Xác nhận chi ${formatPrice(scannedTicket.amount)}`
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ===== Today's Tickets Table ===== */}
      <div className={`${cardCls} p-6`}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-white">
              📋 Danh sách vé hoa hồng hôm nay
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {tickets.length} vé tổng cộng •{" "}
              {tickets.filter((t) => t.status === "pending" && !isExpired(t)).length} chờ chi •{" "}
              {tickets.filter((t) => t.status === "paid").length} đã chi
            </p>
          </div>
          <div className="flex gap-1.5">
            {(
              [
                { key: "all", label: "Tất cả" },
                { key: "pending", label: "Chờ chi" },
                { key: "paid", label: "Đã chi" },
              ] as const
            ).map((f) => (
              <button
                key={f.key}
                onClick={() => setStatusFilter(f.key)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  statusFilter === f.key
                    ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
                    : "bg-white/5 text-gray-400 border border-transparent hover:text-white hover:bg-white/10"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {filteredTickets.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-4xl mb-3">🎫</p>
            <p className="text-gray-500 text-sm">
              {statusFilter === "all"
                ? "Chưa có vé hoa hồng nào hôm nay"
                : `Không có vé "${statusFilter === "pending" ? "chờ chi" : "đã chi"}" nào`}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 text-xs uppercase border-b border-white/5">
                  <th className="text-left pb-3 font-medium">Mã vé</th>
                  <th className="text-left pb-3 font-medium">Tài xế</th>
                  <th className="text-left pb-3 font-medium">SĐT</th>
                  <th className="text-right pb-3 font-medium">Số tiền</th>
                  <th className="text-center pb-3 font-medium">Trạng thái</th>
                  <th className="text-right pb-3 font-medium">Thời gian</th>
                  <th className="text-center pb-3 font-medium">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredTickets.map((ticket) => (
                  <tr
                    key={ticket.id}
                    className="hover:bg-white/5 transition-colors"
                  >
                    <td className="py-3">
                      <span className="font-mono text-white text-xs bg-white/10 px-2 py-1 rounded">
                        {ticket.code}
                      </span>
                    </td>
                    <td className="py-3 text-white">{ticket.driver_name}</td>
                    <td className="py-3 text-gray-400">
                      {ticket.driver_phone || "—"}
                    </td>
                    <td className="py-3 text-right text-emerald-400 font-medium">
                      {formatPrice(ticket.amount)}
                    </td>
                    <td className="py-3 text-center">{statusBadge(ticket)}</td>
                    <td className="py-3 text-right text-gray-400 text-xs">
                      {formatTime(ticket.created_at)}
                    </td>
                    <td className="py-3 text-center">
                      {ticket.status === "pending" && !isExpired(ticket) && (
                        <button
                          onClick={() => {
                            setScanCode(ticket.code);
                            setScannedTicket(ticket);
                            setPayMethod("cash");
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }}
                          className="px-3 py-1.5 text-xs bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 rounded-lg transition-all"
                        >
                          💰 Chi
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
