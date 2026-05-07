"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

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

  useEffect(() => {
    const fetchMenu = async () => {
      try {
        const result = await apiFetch("/api/menu");
        setMenuItems(result.data);
      } catch (err) {
        console.error("Failed to fetch menu:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchMenu();
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
        }),
      });
      setOrderSuccess(result.data);
      setCart([]);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
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
    <div className="flex h-screen">
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
            onClick={submitOrder}
            disabled={cart.length === 0 || submitting}
            className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold rounded-xl shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "Đang xử lý..." : "Tạo đơn hàng"}
          </button>
        </div>
      </div>

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

            <button
              onClick={() => setOrderSuccess(null)}
              className="w-full py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-medium"
            >
              Đóng
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
