"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";

const DEFAULT_INVOICE = `
<div class="text-center mb-6 border-b border-black pb-4">
  <h1 class="text-2xl font-bold uppercase">Hóa Đơn Bán Hàng</h1>
  {{#if is_reprint}}<p class="font-bold italic">(In lần thứ {{print_count}})</p>{{/if}}
  <p class="text-sm mt-1">Mã đơn: {{order.order_number}}</p>
</div>

<table class="w-full mb-6 text-sm">
  <thead>
    <tr class="border-b border-black text-left">
      <th class="py-2">Tên món</th>
      <th class="py-2 text-center">SL</th>
      <th class="py-2 text-right">Thành tiền</th>
    </tr>
  </thead>
  <tbody>
    {{#each order.order_details}}
    <tr class="border-b border-gray-300 border-dashed">
      <td class="py-2">{{this.menu_items.name}}</td>
      <td class="py-2 text-center">{{this.quantity}}</td>
      <td class="py-2 text-right">{{this.subtotal}}₫</td>
    </tr>
    {{/each}}
  </tbody>
  <tfoot>
    <tr class="font-bold text-base">
      <td colspan="2" class="py-4">Tổng cộng:</td>
      <td class="py-4 text-right">{{order.final_amount}}₫</td>
    </tr>
  </tfoot>
</table>
`;

const DEFAULT_TICKET = `
<h2 class="text-2xl font-bold uppercase mb-2">{{ticket_name}}</h2>
{{#if is_reprint}}<p class="font-bold italic">(In lần thứ {{print_count}})</p>{{/if}}
<p class="text-sm">Kèm theo: {{parent_name}}</p>
<p class="text-xs mt-1 text-gray-600">Mã đơn: {{order_number}}</p>
<div class="mt-4 text-xs font-mono">----------------------------------------</div>
`;

export default function PrintSettingsPage() {
  const [invoiceTemplate, setInvoiceTemplate] = useState("");
  const [ticketTemplate, setTicketTemplate] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [branch, setBranch] = useState<any>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await apiFetch("/api/settings/branch");
        setBranch(res.data);
        const settings = res.data?.settings || {};
        setInvoiceTemplate(settings.invoice_template || DEFAULT_INVOICE);
        setTicketTemplate(settings.ticket_template || DEFAULT_TICKET);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const newSettings = {
        ...(branch?.settings || {}),
        invoice_template: invoiceTemplate,
        ticket_template: ticketTemplate,
      };

      await apiFetch("/api/settings/branch", {
        method: "PUT",
        body: JSON.stringify({ settings: newSettings }),
      });
      alert("Đã lưu cấu hình mẫu in thành công!");
    } catch (err: any) {
      alert("Lỗi khi lưu: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Cấu hình Mẫu In</h1>
          <p className="text-gray-400">Thiết kế mẫu in Hóa đơn và Vé bằng mã HTML (hỗ trợ Handlebars variables).</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-medium shadow-lg shadow-emerald-500/20 disabled:opacity-50"
        >
          {saving ? "Đang lưu..." : "Lưu Thay Đổi"}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Invoice Template */}
        <div className="bg-gray-900 border border-white/5 rounded-2xl p-6">
          <h2 className="text-xl font-bold text-emerald-400 mb-4">Mẫu Hóa Đơn</h2>
          <p className="text-sm text-gray-400 mb-4">
            Biến hỗ trợ: <code className="text-emerald-300">{'{{order.order_number}}'}</code>,{' '}
            <code className="text-emerald-300">{'{{order.final_amount}}'}</code>,{' '}
            <code className="text-emerald-300">{'{{#each order.order_details}}...{{/each}}'}</code>,{' '}
            <code className="text-emerald-300">{'{{print_count}}'}</code>,{' '}
            <code className="text-emerald-300">{'{{is_reprint}}'}</code>
          </p>
          <textarea
            className="w-full h-[500px] bg-black text-gray-300 font-mono text-sm p-4 rounded-xl border border-white/10 focus:border-emerald-500 focus:outline-none"
            value={invoiceTemplate}
            onChange={(e) => setInvoiceTemplate(e.target.value)}
            spellCheck={false}
          />
        </div>

        {/* Ticket Template */}
        <div className="bg-gray-900 border border-white/5 rounded-2xl p-6">
          <h2 className="text-xl font-bold text-blue-400 mb-4">Mẫu Vé Đi Kèm</h2>
          <p className="text-sm text-gray-400 mb-4">
            Biến hỗ trợ: <code className="text-blue-300">{'{{ticket_name}}'}</code>,{' '}
            <code className="text-blue-300">{'{{parent_name}}'}</code>,{' '}
            <code className="text-blue-300">{'{{order_number}}'}</code>,{' '}
            <code className="text-blue-300">{'{{print_count}}'}</code>,{' '}
            <code className="text-blue-300">{'{{is_reprint}}'}</code>
          </p>
          <textarea
            className="w-full h-[500px] bg-black text-gray-300 font-mono text-sm p-4 rounded-xl border border-white/10 focus:border-blue-500 focus:outline-none"
            value={ticketTemplate}
            onChange={(e) => setTicketTemplate(e.target.value)}
            spellCheck={false}
          />
        </div>
      </div>
    </div>
  );
}
