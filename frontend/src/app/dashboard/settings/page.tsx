"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";

interface BranchInfo {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  is_active: boolean;
  settings: Record<string, any>;
}

interface BankAccount {
  id: string;
  bank_name: string;
  bank_code: string | null;
  account_number: string;
  account_holder: string;
  is_primary: boolean;
  is_active: boolean;
  sepay_api_key: string | null;
  sepay_webhook_secret: string | null;
}

export default function SettingsPage() {
  const [tab, setTab] = useState<"general" | "bank">("general");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [branch, setBranch] = useState<BranchInfo | null>(null);
  const [banks, setBanks] = useState<BankAccount[]>([]);
  const [form, setForm] = useState({ name: "", address: "", phone: "", email: "" });
  const [bankForm, setBankForm] = useState({ bank_name: "", bank_code: "", account_number: "", account_holder: "", is_primary: false, sepay_api_key: "", sepay_webhook_secret: "" });
  const [editBankId, setEditBankId] = useState<string | null>(null);
  const [showBankForm, setShowBankForm] = useState(false);

  const fetchBranch = useCallback(async () => {
    try {
      const res = await apiFetch("/api/settings/branch");
      setBranch(res.data);
      setForm({ name: res.data.name || "", address: res.data.address || "", phone: res.data.phone || "", email: res.data.email || "" });
    } catch (e) { console.error(e); }
  }, []);

  const fetchBanks = useCallback(async () => {
    try {
      const res = await apiFetch("/api/settings/bank-accounts");
      setBanks(res.data);
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => {
    Promise.all([fetchBranch(), fetchBanks()]).finally(() => setLoading(false));
  }, [fetchBranch, fetchBanks]);

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(""), 3000); };

  const saveBranch = async () => {
    setSaving(true);
    try {
      await apiFetch("/api/settings/branch", { method: "PUT", body: JSON.stringify(form) });
      await fetchBranch();
      flash("✅ Đã lưu thông tin resort");
    } catch (e: any) { flash("❌ " + e.message); }
    finally { setSaving(false); }
  };

  const saveBankAccount = async () => {
    setSaving(true);
    try {
      const payload: any = { ...bankForm };
      if (!payload.bank_code) delete payload.bank_code;
      if (!payload.sepay_api_key) delete payload.sepay_api_key;
      if (!payload.sepay_webhook_secret) delete payload.sepay_webhook_secret;

      if (editBankId) {
        await apiFetch(`/api/settings/bank-accounts/${editBankId}`, { method: "PUT", body: JSON.stringify(payload) });
        flash("✅ Đã cập nhật tài khoản");
      } else {
        await apiFetch("/api/settings/bank-accounts", { method: "POST", body: JSON.stringify(payload) });
        flash("✅ Đã thêm tài khoản");
      }
      await fetchBanks();
      resetBankForm();
    } catch (e: any) { flash("❌ " + e.message); }
    finally { setSaving(false); }
  };

  const deleteBankAccount = async (id: string) => {
    if (!confirm("Bạn chắc chắn muốn xóa tài khoản này?")) return;
    try {
      await apiFetch(`/api/settings/bank-accounts/${id}`, { method: "DELETE" });
      await fetchBanks();
      flash("✅ Đã xóa tài khoản");
    } catch (e: any) { flash("❌ " + e.message); }
  };

  const resetBankForm = () => {
    setBankForm({ bank_name: "", bank_code: "", account_number: "", account_holder: "", is_primary: false, sepay_api_key: "", sepay_webhook_secret: "" });
    setEditBankId(null);
    setShowBankForm(false);
  };

  const editBank = (b: BankAccount) => {
    setBankForm({ bank_name: b.bank_name, bank_code: b.bank_code || "", account_number: b.account_number, account_holder: b.account_holder, is_primary: b.is_primary, sepay_api_key: b.sepay_api_key || "", sepay_webhook_secret: b.sepay_webhook_secret || "" });
    setEditBankId(b.id);
    setShowBankForm(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const inputCls = "w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-all text-sm";
  const labelCls = "block text-sm font-medium text-gray-300 mb-1.5";

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">⚙️ Cài đặt</h1>
        <p className="text-gray-400 text-sm mt-1">Quản lý thông tin resort và thanh toán</p>
      </div>

      {/* Toast */}
      {msg && (
        <div className="fixed top-6 right-6 z-50 px-5 py-3 rounded-xl bg-gray-800/90 border border-white/10 backdrop-blur-xl text-white text-sm shadow-2xl animate-[fadeIn_0.3s_ease]">
          {msg}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2">
        {[
          { key: "general" as const, label: "🏨 Thông tin chung" },
          { key: "bank" as const, label: "🏦 Thanh toán & Ngân hàng" },
        ].map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-5 py-2.5 rounded-xl text-sm font-medium border transition-all ${tab === t.key ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400" : "bg-white/5 border-white/10 text-gray-400 hover:text-white hover:bg-white/10"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab: General */}
      {tab === "general" && (
        <div className="glass-card p-6 space-y-5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "16px", backdropFilter: "blur(20px)" }}>
          <h2 className="text-lg font-semibold text-white">Thông tin Resort / Chi nhánh</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className={labelCls}>Tên Resort / Chi nhánh</label>
              <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="VD: ROM Resort Phú Quốc" />
            </div>
            <div>
              <label className={labelCls}>Email liên hệ</label>
              <input className={inputCls} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="resort@example.com" />
            </div>
            <div>
              <label className={labelCls}>Số điện thoại</label>
              <input className={inputCls} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="0901 234 567" />
            </div>
            <div className="md:col-span-2">
              <label className={labelCls}>Địa chỉ</label>
              <textarea className={inputCls + " resize-none"} rows={3} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/TP" />
            </div>
          </div>
          <div className="pt-3 flex justify-end">
            <button onClick={saveBranch} disabled={saving}
              className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition-all shadow-lg shadow-emerald-500/20"
            >
              {saving ? "Đang lưu..." : "💾 Lưu thay đổi"}
            </button>
          </div>
        </div>
      )}

      {/* Tab: Bank */}
      {tab === "bank" && (
        <div className="space-y-5">
          {/* Bank list */}
          <div className="glass-card p-6" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "16px", backdropFilter: "blur(20px)" }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Danh sách tài khoản ngân hàng</h2>
              <button onClick={() => { resetBankForm(); setShowBankForm(true); }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-medium transition-all"
              >
                + Thêm tài khoản
              </button>
            </div>

            {banks.length === 0 ? (
              <p className="text-gray-500 text-sm py-8 text-center">Chưa có tài khoản ngân hàng nào. Bấm &quot;+ Thêm tài khoản&quot; để bắt đầu.</p>
            ) : (
              <div className="space-y-3">
                {banks.map((b) => (
                  <div key={b.id} className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10 hover:border-white/20 transition-all">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-medium text-sm">{b.bank_name}</span>
                        {b.is_primary && <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded-full text-xs">Mặc định</span>}
                        {!b.is_active && <span className="px-2 py-0.5 bg-red-500/20 text-red-400 rounded-full text-xs">Tắt</span>}
                      </div>
                      <p className="text-gray-400 text-xs mt-1">{b.account_holder} • {b.account_number}</p>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <button onClick={() => editBank(b)} className="px-3 py-1.5 text-xs text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-all">✏️ Sửa</button>
                      <button onClick={() => deleteBankAccount(b.id)} className="px-3 py-1.5 text-xs text-gray-400 hover:text-red-400 bg-white/5 hover:bg-red-500/10 rounded-lg transition-all">🗑️ Xóa</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Bank form modal */}
          {showBankForm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
              <div className="w-full max-w-lg p-6 space-y-4" style={{ background: "rgba(20,20,30,0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "16px", backdropFilter: "blur(20px)" }}>
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-white">{editBankId ? "✏️ Sửa tài khoản" : "➕ Thêm tài khoản"}</h3>
                  <button onClick={resetBankForm} className="text-gray-400 hover:text-white text-xl">✕</button>
                </div>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>Ngân hàng</label>
                      <input className={inputCls} value={bankForm.bank_name} onChange={(e) => setBankForm({ ...bankForm, bank_name: e.target.value })} placeholder="VD: Vietcombank" />
                    </div>
                    <div>
                      <label className={labelCls}>Mã NH (tùy chọn)</label>
                      <input className={inputCls} value={bankForm.bank_code} onChange={(e) => setBankForm({ ...bankForm, bank_code: e.target.value })} placeholder="VD: VCB" />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Số tài khoản</label>
                    <input className={inputCls} value={bankForm.account_number} onChange={(e) => setBankForm({ ...bankForm, account_number: e.target.value })} placeholder="0123456789" />
                  </div>
                  <div>
                    <label className={labelCls}>Tên chủ tài khoản</label>
                    <input className={inputCls} value={bankForm.account_holder} onChange={(e) => setBankForm({ ...bankForm, account_holder: e.target.value })} placeholder="NGUYEN VAN A" />
                  </div>
                  <div>
                    <label className={labelCls}>Sepay API Key (tùy chọn)</label>
                    <input className={inputCls} value={bankForm.sepay_api_key} onChange={(e) => setBankForm({ ...bankForm, sepay_api_key: e.target.value })} placeholder="Nhập API key nếu dùng Sepay" />
                  </div>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={bankForm.is_primary} onChange={(e) => setBankForm({ ...bankForm, is_primary: e.target.checked })}
                      className="w-4 h-4 rounded border-white/20 bg-white/5 text-emerald-500 focus:ring-emerald-500/30" />
                    <span className="text-sm text-gray-300">Đặt làm tài khoản mặc định</span>
                  </label>
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button onClick={resetBankForm} className="px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm text-gray-300">Hủy</button>
                  <button onClick={saveBankAccount} disabled={saving || !bankForm.bank_name || !bankForm.account_number || !bankForm.account_holder}
                    className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition-all"
                  >
                    {saving ? "Đang lưu..." : "💾 Lưu"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
