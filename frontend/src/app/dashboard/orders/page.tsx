"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import Handlebars from "handlebars";

export default function OrdersHistoryPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  
  const [printMode, setPrintMode] = useState<"none" | "invoice" | "tickets">("none");
  const [printCount, setPrintCount] = useState<number>(1);
  const [branchSettings, setBranchSettings] = useState<any>({});

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [ordersRes, settingsRes] = await Promise.all([
          apiFetch("/api/orders"),
          apiFetch("/api/settings/branch").catch(() => ({ data: { settings: {} } }))
        ]);
        setOrders(ordersRes.data || []);
        setBranchSettings(settingsRes.data?.settings || {});
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const openOrder = async (orderId: string) => {
    try {
      // Fetch full order details including package tickets
      // The list API only has order summary. We can reuse the GET /api/orders/{id}
      // Wait, GET /api/orders/{id} doesn't return package_tickets!
      // I will update GET /api/orders/{id} to also return package tickets in backend.
      // Wait, I didn't update GET /api/orders/{id} earlier. I will update it in backend next.
      const res = await apiFetch(`/api/orders/${orderId}`);
      setSelectedOrder(res.data);
    } catch (err: any) {
      alert("Lỗi: " + err.message);
    }
  };

  const handlePrintInvoice = async (orderId: string) => {
    try {
      const res = await apiFetch(`/api/orders/${orderId}/print-invoice`, { method: "POST" });
      setPrintMode("invoice");
      setPrintCount(res.print_count);
      setTimeout(() => window.print(), 300);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handlePrintTickets = async (orderId: string) => {
    try {
      const res = await apiFetch(`/api/orders/${orderId}/print-tickets`, { method: "POST" });
      setPrintMode("tickets");
      setPrintCount(res.print_count);
      setTimeout(() => window.print(), 300);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const renderTemplate = (template: string, data: any) => {
    if (!template) return null;
    try {
      const compiled = Handlebars.compile(template);
      return compiled(data);
    } catch (err) {
      return "Lỗi mẫu in.";
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
    <>
      <div className="p-6 max-w-6xl mx-auto print:hidden">
        <h1 className="text-3xl font-bold text-white mb-8">Lịch sử Đơn hàng</h1>
        
        <div className="bg-gray-900 border border-white/5 rounded-2xl overflow-hidden">
          <table className="w-full text-left text-sm text-gray-300">
            <thead className="bg-white/5 border-b border-white/5 text-gray-400">
              <tr>
                <th className="px-6 py-4 font-medium">Mã đơn</th>
                <th className="px-6 py-4 font-medium">Ngày tạo</th>
                <th className="px-6 py-4 font-medium">Loại</th>
                <th className="px-6 py-4 font-medium">Tổng tiền</th>
                <th className="px-6 py-4 font-medium">Trạng thái</th>
                <th className="px-6 py-4 font-medium text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {orders.map((o) => (
                <tr key={o.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-6 py-4 font-mono text-emerald-400">{o.order_number}</td>
                  <td className="px-6 py-4">{new Date(o.created_at).toLocaleString('vi-VN')}</td>
                  <td className="px-6 py-4">
                    {o.order_type === 'fnb' ? 'F&B / Dịch vụ' : 'Đặt phòng'}
                  </td>
                  <td className="px-6 py-4 font-bold text-white">
                    {o.final_amount.toLocaleString('vi-VN')}₫
                  </td>
                  <td className="px-6 py-4">
                    {o.payment_status === 'paid' && <span className="text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded">Đã thanh toán</span>}
                    {o.payment_status === 'partial' && <span className="text-orange-400 bg-orange-400/10 px-2 py-1 rounded">TT 1 phần</span>}
                    {o.payment_status === 'unpaid' && <span className="text-red-400 bg-red-400/10 px-2 py-1 rounded">Chưa thanh toán</span>}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => openOrder(o.id)}
                      className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
                    >
                      Xem / In lại
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Modal Chi tiết đơn */}
        {selectedOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-lg p-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-white">Chi tiết {selectedOrder.order_number}</h3>
                <button onClick={() => { setSelectedOrder(null); setPrintMode("none"); }} className="text-gray-400 hover:text-white">✕</button>
              </div>

              <div className="space-y-4 mb-6 max-h-[60vh] overflow-y-auto pr-2">
                {selectedOrder.order_details?.map((d: any) => (
                  <div key={d.id} className="flex justify-between p-3 bg-white/5 rounded-xl">
                    <div>
                      <div className="text-white font-medium">{d.menu_items?.name}</div>
                      <div className="text-sm text-gray-400">SL: {d.quantity} x {d.unit_price.toLocaleString('vi-VN')}₫</div>
                    </div>
                    <div className="text-white font-bold">{d.subtotal.toLocaleString('vi-VN')}₫</div>
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-center border-t border-white/10 pt-4 mb-6">
                <span className="text-gray-400">Tổng cộng:</span>
                <span className="text-2xl font-bold text-emerald-400">{selectedOrder.final_amount?.toLocaleString('vi-VN')}₫</span>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => handlePrintInvoice(selectedOrder.id)}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-medium shadow-lg"
                >
                  🖨️ In Hóa Đơn
                </button>
                {selectedOrder.package_tickets?.length > 0 && (
                  <button
                    onClick={() => handlePrintTickets(selectedOrder.id)}
                    className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium shadow-lg"
                  >
                    🎟️ In Vé
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Printable Area (Only shows when printing) */}
      {selectedOrder && printMode !== "none" && (
        <div className="hidden print:block p-8 text-black bg-white min-h-screen">
          {printMode === "invoice" && (
            <>
              {branchSettings.invoice_template ? (
                <div 
                  dangerouslySetInnerHTML={{ 
                    __html: renderTemplate(branchSettings.invoice_template, {
                      order: selectedOrder,
                      print_count: printCount,
                      is_reprint: printCount > 1
                    }) || ""
                  }} 
                />
              ) : (
                <div>
                  <div className="text-center mb-6 border-b border-black pb-4">
                    <h1 className="text-2xl font-bold uppercase">Hóa Đơn Bán Hàng</h1>
                    {printCount > 1 && <p className="font-bold italic">(In lần thứ {printCount})</p>}
                    <p className="text-sm mt-1">Mã đơn: {selectedOrder.order_number}</p>
                    <p className="text-sm">Ngày: {new Date(selectedOrder.created_at).toLocaleString('vi-VN')}</p>
                  </div>
                  <table className="w-full mb-6 text-sm">
                    <thead>
                      <tr className="border-b border-black text-left">
                        <th className="py-2">Tên món</th>
                        <th className="py-2 text-center">SL</th>
                        <th className="py-2 text-right">Thành tiền</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedOrder.order_details?.map((d: any, idx: number) => (
                        <tr key={idx} className="border-b border-gray-300 border-dashed">
                          <td className="py-2">{d.menu_items?.name}</td>
                          <td className="py-2 text-center">{d.quantity}</td>
                          <td className="py-2 text-right">{d.subtotal.toLocaleString('vi-VN')}₫</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="font-bold text-base">
                        <td colSpan={2} className="py-4">Tổng cộng:</td>
                        <td className="py-4 text-right">{selectedOrder.final_amount?.toLocaleString('vi-VN')}₫</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </>
          )}

          {printMode === "tickets" && selectedOrder.package_tickets?.length > 0 && (
            <div className="pt-4">
              {selectedOrder.order_details?.map((d: any, idx: number) => {
                const tickets = selectedOrder.package_tickets.filter((t: any) => t.parent_item_id === d.menu_item_id);
                if (tickets.length === 0) return null;
                
                const ticketsToPrint: string[] = [];
                for (let i = 0; i < d.quantity; i++) {
                  tickets.forEach((t: any) => {
                    for (let j = 0; j < t.quantity; j++) {
                      ticketsToPrint.push(t.child?.name);
                    }
                  });
                }

                return ticketsToPrint.map((ticketName, tIdx) => (
                  <div key={`${idx}-${tIdx}`} className="border-2 border-dashed border-black p-6 mb-6 text-center break-inside-avoid rounded-xl">
                    {branchSettings.ticket_template ? (
                       <div 
                         dangerouslySetInnerHTML={{ 
                           __html: renderTemplate(branchSettings.ticket_template, {
                             ticket_name: ticketName,
                             parent_name: d.menu_items?.name,
                             order_number: selectedOrder.order_number,
                             print_count: printCount,
                             is_reprint: printCount > 1
                           }) || ""
                         }} 
                       />
                    ) : (
                      <>
                        <h2 className="text-2xl font-bold uppercase mb-2">{ticketName}</h2>
                        {printCount > 1 && <p className="font-bold italic">(In lần thứ {printCount})</p>}
                        <p className="text-sm">Kèm theo: {d.menu_items?.name}</p>
                        <p className="text-xs mt-1 text-gray-600">Mã đơn: {selectedOrder.order_number}</p>
                        <div className="mt-4 text-xs font-mono">----------------------------------------</div>
                      </>
                    )}
                  </div>
                ));
              })}
            </div>
          )}
        </div>
      )}
    </>
  );
}
