"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import Handlebars from "handlebars";

interface MenuItem {
  id: string;
  name: string;
  category: string;
  price: number;
  description: string | null;
}

interface CartItem extends MenuItem {
  quantity: number;
  notes: string;
}

export default function POSPage() {
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("all");
  const [orderSuccess, setOrderSuccess] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [payments, setPayments] = useState<{ method_type: string; amount: number }[]>([]);
  const [printMode, setPrintMode] = useState<"none" | "invoice" | "tickets">("none");
  const [printCount, setPrintCount] = useState<number>(1);
  const [branchSettings, setBranchSettings] = useState<any>({});

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [menuRes, settingsRes] = await Promise.all([
          apiFetch("/api/menu"),
          apiFetch("/api/settings/branch").catch(() => ({ data: { settings: {} } }))
        ]);
        setMenuItems(menuRes.data || []);
        setBranchSettings(settingsRes.data?.settings || {});
      } catch (err) {
        console.error("Failed to fetch data:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const categories = ["all", ...new Set(menuItems.map((m) => m.category).filter(Boolean))];

  const filteredItems =
    activeCategory === "all"
      ? menuItems
      : menuItems.filter((m) => m.category === activeCategory);

  const addToCart = (item: MenuItem) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.id === item.id);
      if (existing) {
        return prev.map((c) =>
          c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c
        );
      }
      return [...prev, { ...item, quantity: 1, notes: "" }];
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) => (c.id === id ? { ...c, quantity: c.quantity + delta } : c))
        .filter((c) => c.quantity > 0)
    );
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter((c) => c.id !== id));
  };

  const totalAmount = cart.reduce((sum, c) => sum + c.price * c.quantity, 0);

  const submitOrder = async () => {
    if (cart.length === 0) return;
    setSubmitting(true);

    try {
      const result = await apiFetch("/api/orders", {
        method: "POST",
        body: JSON.stringify({
          order_type: "fnb",
          items: cart.map((c) => ({
            menu_item_id: c.id,
            quantity: c.quantity,
            notes: c.notes || null,
          })),
          payments: payments,
        }),
      });
      setOrderSuccess(result.data);
      setCart([]);
      setShowPaymentModal(false);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const openPaymentModal = () => {
    setPayments([{ method_type: "cash", amount: totalAmount }]);
    setShowPaymentModal(true);
  };

  // VietQR URL generator
  const generateQRUrl = (amount: number, orderNumber: string) => {
    // Using VietQR API - replace with actual bank info
    const bankId = "VCB";
    const accountNo = "1234567890";
    const accountName = "CONG TY ROM RESORT";
    const content = `SEVQR ROM ${orderNumber}`;
    return `https://img.vietqr.io/image/${bankId}-${accountNo}-compact.png?amount=${amount}&addInfo=${encodeURIComponent(content)}&accountName=${encodeURIComponent(accountName)}`;
  };

  return (
    <>
    <div className="flex h-screen print:hidden">
      {/* Menu Grid */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-6 pb-0">
          <h1 className="text-2xl font-bold text-white">POS Order</h1>
          <p className="text-gray-400 text-sm mt-1">Chọn món để tạo đơn hàng</p>
        </div>

        {/* Category Tabs */}
        <div className="px-6 py-4 flex gap-2 overflow-x-auto">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap border transition-all ${
                activeCategory === cat
                  ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                  : "bg-white/5 border-white/10 text-gray-400 hover:text-white"
              }`}
            >
              {cat === "all" ? "Tất cả" : cat}
            </button>
          ))}
        </div>

        {/* Items Grid */}
        <div className="flex-1 overflow-auto px-6 pb-6">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin h-8 w-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {filteredItems.map((item) => {
                const inCart = cart.find((c) => c.id === item.id);
                return (
                  <button
                    key={item.id}
                    onClick={() => addToCart(item)}
                    className={`p-4 rounded-xl border text-left hover:scale-[1.02] active:scale-[0.98] transition-all ${
                      inCart
                        ? "bg-emerald-500/10 border-emerald-500/30"
                        : "bg-white/5 border-white/10 hover:bg-white/10"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <h3 className="font-medium text-white text-sm">{item.name}</h3>
                      {inCart && (
                        <span className="w-6 h-6 rounded-full bg-emerald-500 text-white text-xs flex items-center justify-center font-bold">
                          {inCart.quantity}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-1 line-clamp-1">{item.description}</p>
                    <p className="text-emerald-400 font-semibold text-sm mt-2">
                      {item.price.toLocaleString("vi-VN")}₫
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Cart Sidebar */}
      <div className="w-80 lg:w-96 bg-gray-900/50 border-l border-white/5 flex flex-col">
        <div className="p-4 border-b border-white/5">
          <h2 className="text-lg font-bold text-white">
            🛒 Đơn hàng
            {cart.length > 0 && (
              <span className="text-sm text-gray-400 font-normal ml-2">
                ({cart.reduce((s, c) => s + c.quantity, 0)} món)
              </span>
            )}
          </h2>
        </div>

        {/* Cart Items */}
        <div className="flex-1 overflow-auto p-4 space-y-2">
          {cart.length === 0 ? (
            <div className="text-center text-gray-500 py-10">
              <p className="text-4xl mb-2">🍽️</p>
              <p className="text-sm">Chưa chọn món nào</p>
            </div>
          ) : (
            cart.map((item) => (
              <div
                key={item.id}
                className="p-3 bg-white/5 rounded-xl border border-white/10"
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-white flex-1 truncate">{item.name}</h4>
                  <span className="text-sm text-emerald-400 font-semibold ml-2">
                    {(item.price * item.quantity).toLocaleString("vi-VN")}₫
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <button
                    onClick={() => updateQuantity(item.id, -1)}
                    className="w-7 h-7 rounded-lg bg-white/10 hover:bg-red-500/20 text-white text-sm flex items-center justify-center"
                  >
                    −
                  </button>
                  <span className="text-white text-sm font-medium w-8 text-center">
                    {item.quantity}
                  </span>
                  <button
                    onClick={() => updateQuantity(item.id, 1)}
                    className="w-7 h-7 rounded-lg bg-white/10 hover:bg-emerald-500/20 text-white text-sm flex items-center justify-center"
                  >
                    +
                  </button>
                  <button
                    onClick={() => removeFromCart(item.id)}
                    className="w-7 h-7 ml-2 rounded-lg bg-red-500/10 hover:bg-red-500/30 text-red-400 text-xs flex items-center justify-center transition-colors"
                    title="Xóa khỏi giỏ hàng"
                  >
                    🗑️
                  </button>
                  <span className="text-xs text-gray-400 ml-auto">
                    @{item.price.toLocaleString("vi-VN")}₫
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Total & Checkout */}
        <div className="p-4 border-t border-white/5 space-y-3">
          <div className="flex justify-between text-lg">
            <span className="text-gray-300 font-medium">Tổng cộng</span>
            <span className="text-white font-bold">
              {totalAmount.toLocaleString("vi-VN")}₫
            </span>
          </div>
          <button
            onClick={openPaymentModal}
            disabled={cart.length === 0 || submitting}
            className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold rounded-xl shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Thanh toán
          </button>
        </div>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-gray-900 border border-white/10 rounded-2xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white">Thanh toán</h3>
              <button
                onClick={() => setShowPaymentModal(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="bg-white/5 rounded-xl p-4 mb-6 flex justify-between items-center">
              <span className="text-gray-400">Tổng thanh toán:</span>
              <span className="text-2xl font-bold text-emerald-400">
                {totalAmount.toLocaleString("vi-VN")}₫
              </span>
            </div>

            <div className="space-y-4 mb-6">
              {payments.map((p, index) => (
                <div key={index} className="flex gap-2">
                  <select
                    className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
                    value={p.method_type}
                    onChange={(e) => {
                      const newP = [...payments];
                      newP[index].method_type = e.target.value;
                      setPayments(newP);
                    }}
                  >
                    <option value="cash" className="bg-gray-800">Tiền mặt</option>
                    <option value="bank_transfer" className="bg-gray-800">Chuyển khoản</option>
                    <option value="card" className="bg-gray-800">Quẹt thẻ</option>
                    <option value="e_wallet" className="bg-gray-800">Ví điện tử</option>
                  </select>
                  <input
                    type="number"
                    min={0}
                    className="w-1/2 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
                    value={p.amount}
                    onChange={(e) => {
                      const newP = [...payments];
                      newP[index].amount = parseFloat(e.target.value) || 0;
                      setPayments(newP);
                    }}
                  />
                  {payments.length > 1 && (
                    <button
                      onClick={() => setPayments(payments.filter((_, i) => i !== index))}
                      className="px-3 text-red-400 hover:bg-red-500/10 rounded-xl"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}

              <button
                onClick={() =>
                  setPayments([...payments, { method_type: "bank_transfer", amount: 0 }])
                }
                className="text-emerald-400 text-sm font-medium hover:underline"
              >
                + Thêm hình thức thanh toán
              </button>
            </div>

            {/* Change/Remaining Calc */}
            <div className="flex justify-between items-center mb-6 pt-4 border-t border-white/10">
              <span className="text-gray-400 text-sm">
                {payments.reduce((sum, p) => sum + p.amount, 0) >= totalAmount ? "Tiền thừa:" : "Còn thiếu:"}
              </span>
              <span className={`text-lg font-bold ${payments.reduce((sum, p) => sum + p.amount, 0) >= totalAmount ? "text-gray-300" : "text-red-400"}`}>
                {Math.abs(payments.reduce((sum, p) => sum + p.amount, 0) - totalAmount).toLocaleString("vi-VN")}₫
              </span>
            </div>

            <button
              onClick={submitOrder}
              disabled={submitting}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl disabled:opacity-50"
            >
              {submitting ? "Đang xử lý..." : "Xác nhận & Tạo Đơn"}
            </button>
          </div>
        </div>
      )}

      {/* Order Success Modal with QR */}
      {orderSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-sm p-6 text-center space-y-4">
            <div className="text-5xl">✅</div>
            <h3 className="text-xl font-bold text-white">Đã tạo đơn!</h3>
            <p className="text-emerald-400 font-mono text-lg">{orderSuccess.order_number}</p>
            <p className="text-2xl font-bold text-white">
              {orderSuccess.final_amount?.toLocaleString("vi-VN")}₫
            </p>

            {/* VietQR */}
            <div className="bg-white rounded-xl p-3">
              <img
                src={generateQRUrl(orderSuccess.final_amount, orderSuccess.order_number)}
                alt="VietQR Payment"
                className="w-full"
              />
            </div>
            <p className="text-xs text-gray-400">
              Nội dung CK: <span className="text-white font-mono">SEVQR ROM {orderSuccess.order_number}</span>
            </p>

            <div className="flex gap-3 mt-4">
              <button
                onClick={() => handlePrintInvoice(orderSuccess.id)}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-medium shadow-lg shadow-emerald-500/20"
              >
                🖨️ In Hóa Đơn
              </button>
              {orderSuccess.package_tickets?.length > 0 && (
                <button
                  onClick={() => handlePrintTickets(orderSuccess.id)}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium shadow-lg shadow-blue-500/20"
                >
                  🎟️ In Vé
                </button>
              )}
            </div>
            <button
              onClick={() => {
                setOrderSuccess(null);
                setPrintMode("none");
              }}
              className="w-full mt-3 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-medium"
            >
              Đóng & Tiếp tục
            </button>
          </div>
        </div>
      )}
    </div>

    {/* Printable Area (Only shows when printing) */}
    {orderSuccess && printMode !== "none" && (
      <div className="hidden print:block p-8 text-black bg-white min-h-screen">
        {printMode === "invoice" && (
          <>
            {branchSettings.invoice_template ? (
              <div 
                dangerouslySetInnerHTML={{ 
                  __html: renderTemplate(branchSettings.invoice_template, {
                    order: orderSuccess,
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
                  <p className="text-sm mt-1">Mã đơn: {orderSuccess.order_number}</p>
                  <p className="text-sm">Ngày: {new Date(orderSuccess.created_at).toLocaleString('vi-VN')}</p>
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
                    {orderSuccess.order_details?.map((d: any, idx: number) => (
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
                      <td className="py-4 text-right">{orderSuccess.final_amount?.toLocaleString('vi-VN')}₫</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </>
        )}

        {printMode === "tickets" && orderSuccess.package_tickets?.length > 0 && (
          <div className="pt-4">
            {orderSuccess.order_details?.map((d: any, idx: number) => {
              const tickets = orderSuccess.package_tickets.filter((t: any) => t.parent_item_id === d.menu_item_id);
              if (tickets.length === 0) return null;
              
              const ticketsToPrint = [];
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
                           order_number: orderSuccess.order_number,
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
                      <p className="text-xs mt-1 text-gray-600">Mã đơn: {orderSuccess.order_number}</p>
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
