"use client";

import { useEffect, useState, useCallback } from "react";
import { apiFetch } from "@/lib/api";

/* ───── Types ───── */
interface MenuItem {
  id: string;
  name: string;
  category: string;
  price: number;
  item_type: string | null; // 'goods' | 'service'
  is_available: boolean;
}

interface PackageInclude {
  id: string;
  parent_menu_item_id: string;
  child_menu_item_id: string;
  quantity: number;
  child_item?: MenuItem;
}

interface CommissionSetting {
  id: string;
  menu_item_id: string;
  commission_type: "fixed" | "percentage";
  commission_value: number;
  is_active: boolean;
}

/* ───── Page ───── */
export default function ServiceSettingsPage() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  // Selected item
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Package includes
  const [packages, setPackages] = useState<PackageInclude[]>([]);
  const [loadingPkg, setLoadingPkg] = useState(false);
  const [addChildId, setAddChildId] = useState("");
  const [addChildQty, setAddChildQty] = useState(1);

  // Commission
  const [commSettings, setCommSettings] = useState<CommissionSetting[]>([]);
  const [commType, setCommType] = useState<"fixed" | "percentage">("fixed");
  const [commValue, setCommValue] = useState<number>(0);
  const [savingComm, setSavingComm] = useState(false);

  // Filter
  const [filterType, setFilterType] = useState<"all" | "service" | "goods">("all");
  const [searchText, setSearchText] = useState("");

  // Add Item Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addName, setAddName] = useState("");
  const [addPrice, setAddPrice] = useState(0);
  const [addType, setAddType] = useState<"goods" | "service">("goods");
  const [addAvailable, setAddAvailable] = useState(true);
  const [addingItem, setAddingItem] = useState(false);

  const flash = (m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(""), 3000);
  };

  /* ───── Fetch items ───── */
  const fetchItems = useCallback(async () => {
    try {
      const res = await apiFetch("/api/menu?all_status=true");
      setItems(res.data || []);
    } catch (e) {
      console.error(e);
    }
  }, []);

  /* ───── Fetch commission settings ───── */
  const fetchCommSettings = useCallback(async () => {
    try {
      const res = await apiFetch("/api/commission/settings");
      setCommSettings(res.data || []);
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchItems(), fetchCommSettings()]).finally(() =>
      setLoading(false)
    );
  }, [fetchItems, fetchCommSettings]);

  /* ───── Select item ───── */
  const selectedItem = items.find((i) => i.id === selectedId);

  const selectItem = async (item: MenuItem) => {
    setSelectedId(item.id);

    // Load packages if service
    if (item.item_type === "service") {
      setLoadingPkg(true);
      try {
        const res = await apiFetch(
          `/api/commission/packages/${item.id}`
        );
        setPackages(res.data || []);
      } catch {
        setPackages([]);
      } finally {
        setLoadingPkg(false);
      }
    } else {
      setPackages([]);
    }

    // Load commission for this item
    const existing = commSettings.find((c) => c.menu_item_id === item.id);
    if (existing) {
      setCommType(existing.commission_type);
      setCommValue(existing.commission_value);
    } else {
      setCommType("fixed");
      setCommValue(0);
    }
  };

  /* ───── Update item_type ───── */
  const updateItemType = async (id: string, newType: string) => {
    try {
      await apiFetch(`/api/menu/${id}/item-type?item_type=${newType}`, {
        method: "PUT",
      });
      await fetchItems();
      flash(`✅ Đã cập nhật loại sản phẩm`);

      // Re-select if this is the selected item
      if (selectedId === id) {
        const updated = { ...items.find((i) => i.id === id)!, item_type: newType };
        await selectItem(updated);
      }
    } catch (e: any) {
      flash("❌ " + e.message);
    }
  };

  /* ───── Add/Edit/Delete Item ───── */
  const openAddModal = () => {
    setEditingId(null);
    setAddName("");
    setAddPrice(0);
    setAddType("goods");
    setAddAvailable(true);
    setShowAddModal(true);
  };

  const openEditModal = (item: MenuItem) => {
    setEditingId(item.id);
    setAddName(item.name);
    setAddPrice(item.price);
    setAddType(item.item_type as "goods" | "service" || "goods");
    setAddAvailable(item.is_available);
    setShowAddModal(true);
  };

  const deleteItem = async (id: string) => {
    if (!confirm("Xóa sản phẩm này sẽ xóa tất cả cài đặt liên quan (nếu có). Tiếp tục?")) return;
    try {
      await apiFetch(`/api/menu/${id}`, { method: "DELETE" });
      await fetchItems();
      if (selectedId === id) setSelectedId(null);
      flash("✅ Đã xóa sản phẩm");
    } catch (e: any) {
      flash("❌ " + e.message);
    }
  };

  const saveItem = async () => {
    if (!addName.trim()) return;
    setAddingItem(true);
    try {
      if (editingId) {
        await apiFetch(`/api/menu/${editingId}`, {
          method: "PUT",
          body: JSON.stringify({
            name: addName.trim(),
            price: addPrice,
            item_type: addType,
            category: addType === "goods" ? "Khác" : "Dịch vụ",
            is_available: addAvailable
          })
        });
        flash("✅ Đã cập nhật thành công");
      } else {
        await apiFetch("/api/menu", {
          method: "POST",
          body: JSON.stringify({
            name: addName.trim(),
            price: addPrice,
            item_type: addType,
            category: addType === "goods" ? "Khác" : "Dịch vụ",
            is_available: addAvailable
          })
        });
        flash("✅ Đã thêm sản phẩm mới");
      }
      
      // Update local state without waiting for re-fetch to fix selection
      await fetchItems();
      setShowAddModal(false);
    } catch (e: any) {
      flash("❌ " + e.message);
    } finally {
      setAddingItem(false);
    }
  };

  /* ───── Package includes ───── */
  const addPackageInclude = async () => {
    if (!selectedId || !addChildId) return;
    try {
      await apiFetch("/api/commission/packages", {
        method: "POST",
        body: JSON.stringify({
          parent_menu_item_id: selectedId,
          child_menu_item_id: addChildId,
          quantity: addChildQty,
        }),
      });
      const res = await apiFetch(`/api/commission/packages/${selectedId}`);
      setPackages(res.data || []);
      setAddChildId("");
      setAddChildQty(1);
      flash("✅ Đã thêm vé tặng kèm");
    } catch (e: any) {
      flash("❌ " + e.message);
    }
  };

  const removePackageInclude = async (pkgId: string) => {
    if (!confirm("Xóa vé tặng kèm này?")) return;
    try {
      await apiFetch(`/api/commission/packages/${pkgId}`, {
        method: "DELETE",
      });
      setPackages((prev) => prev.filter((p) => p.id !== pkgId));
      flash("✅ Đã xóa");
    } catch (e: any) {
      flash("❌ " + e.message);
    }
  };

  /* ───── Commission ───── */
  const saveCommission = async () => {
    if (!selectedId) return;
    setSavingComm(true);
    try {
      await apiFetch("/api/commission/settings", {
        method: "POST",
        body: JSON.stringify({
          menu_item_id: selectedId,
          commission_type: commType,
          commission_value: commValue,
        }),
      });
      await fetchCommSettings();
      flash("✅ Đã lưu cài đặt hoa hồng");
    } catch (e: any) {
      flash("❌ " + e.message);
    } finally {
      setSavingComm(false);
    }
  };

  const deleteCommission = async () => {
    if (!selectedId) return;
    const existing = commSettings.find((c) => c.menu_item_id === selectedId);
    if (!existing) return;
    if (!confirm("Xóa cài đặt hoa hồng cho mục này?")) return;
    try {
      await apiFetch(`/api/commission/settings/${existing.id}`, {
        method: "DELETE",
      });
      await fetchCommSettings();
      setCommType("fixed");
      setCommValue(0);
      flash("✅ Đã xóa cài đặt hoa hồng");
    } catch (e: any) {
      flash("❌ " + e.message);
    }
  };

  /* ───── Filtered items ───── */
  const filteredItems = items.filter((item) => {
    const matchesType =
      filterType === "all" || (item.item_type || "goods") === filterType;
    const matchesSearch =
      !searchText ||
      item.name.toLowerCase().includes(searchText.toLowerCase()) ||
      item.category.toLowerCase().includes(searchText.toLowerCase());
    return matchesType && matchesSearch;
  });

  // Items available as children (exclude the selected item itself)
  const childCandidates = items.filter((i) => i.id !== selectedId);

  /* ───── Helpers ───── */
  const getItemName = (id: string) =>
    items.find((i) => i.id === id)?.name || id;

  const formatPrice = (v: number) =>
    new Intl.NumberFormat("vi-VN").format(v) + "đ";

  const itemTypeLabel = (t: string | null) => {
    if (t === "service") return "Dịch vụ";
    return "Hàng hóa";
  };

  const itemTypeBadge = (t: string | null) => {
    if (t === "service")
      return "px-2.5 py-0.5 bg-teal-500/20 text-teal-400 rounded-full text-xs font-medium";
    return "px-2.5 py-0.5 bg-blue-500/20 text-blue-400 rounded-full text-xs font-medium";
  };

  const hasCommission = (itemId: string) =>
    commSettings.some((c) => c.menu_item_id === itemId);

  /* ───── Styles ───── */
  const inputCls =
    "w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 transition-all text-sm";
  const labelCls = "block text-sm font-medium text-gray-300 mb-1.5";
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
    <div className="p-6 space-y-6">
      {/* Toast */}
      {msg && (
        <div className="fixed top-6 right-6 z-50 px-5 py-3 rounded-xl bg-gray-800/90 border border-white/10 backdrop-blur-xl text-white text-sm shadow-2xl animate-[fadeIn_0.3s_ease]">
          {msg}
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">
          🎟️ Cài đặt Dịch vụ & Hoa hồng
        </h1>
        <p className="text-gray-400 text-sm mt-1">
          Quản lý loại sản phẩm, vé trọn gói và hoa hồng tài xế
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* ===== LEFT: Item list ===== */}
        <div className="lg:col-span-5">
          <div className={`${cardCls} p-5`}>
            <h2 className="text-lg font-semibold text-white mb-4">
              Danh sách sản phẩm
            </h2>

            {/* Search + filter */}
            <div className="flex gap-2 mb-4">
              <input
                className={inputCls + " flex-1"}
                placeholder="🔍 Tìm tên, danh mục..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
              <select
                className="px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm text-gray-300 focus:outline-none focus:border-emerald-500/50"
                value={filterType}
                onChange={(e) =>
                  setFilterType(e.target.value as "all" | "service" | "goods")
                }
              >
                <option value="all" className="bg-gray-900 text-white">Tất cả</option>
                <option value="goods" className="bg-gray-900 text-white">Hàng hóa</option>
                <option value="service" className="bg-gray-900 text-white">Dịch vụ</option>
              </select>
              <button
                onClick={openAddModal}
                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-medium transition-all whitespace-nowrap"
              >
                + Thêm
              </button>
            </div>

            {/* Items */}
            <div className="space-y-1.5 max-h-[calc(100vh-320px)] overflow-y-auto pr-1">
              {filteredItems.length === 0 ? (
                <p className="text-gray-500 text-sm py-8 text-center">
                  Không tìm thấy sản phẩm nào
                </p>
              ) : (
                filteredItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => selectItem(item)}
                    className={`w-full text-left flex items-center justify-between p-3 rounded-xl text-sm transition-all ${
                      selectedId === item.id
                        ? "bg-emerald-500/15 border border-emerald-500/20"
                        : "bg-white/5 border border-transparent hover:bg-white/10 hover:border-white/10"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={
                            selectedId === item.id
                              ? "text-emerald-400 font-medium"
                              : "text-white"
                          }
                        >
                          {item.name}
                        </span>
                        {!item.is_available && (
                          <span className="px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded text-[10px] whitespace-nowrap">
                            Ngừng bán
                          </span>
                        )}
                        {hasCommission(item.id) && (
                          <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded text-[10px]">
                            💰
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {item.category} • {formatPrice(item.price)}
                      </p>
                    </div>
                    <span className={itemTypeBadge(item.item_type)}>
                      {itemTypeLabel(item.item_type)}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* ===== RIGHT: Detail panel ===== */}
        <div className="lg:col-span-7 space-y-5">
          {!selectedItem ? (
            <div className={`${cardCls} p-12 text-center`}>
              <p className="text-5xl mb-4">👈</p>
              <h3 className="text-lg font-medium text-white mb-2">
                Chọn sản phẩm
              </h3>
              <p className="text-gray-400 text-sm">
                Chọn một sản phẩm từ danh sách bên trái để xem & cấu hình chi
                tiết
              </p>
            </div>
          ) : (
            <>
              {/* Item info + type selector */}
              <div className={`${cardCls} p-5`}>
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-white">
                      {selectedItem.name}
                      <button onClick={() => openEditModal(selectedItem)} className="ml-3 px-2 py-1 text-xs text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-all border border-white/10">✏️ Sửa</button>
                      <button onClick={() => deleteItem(selectedItem.id)} className="ml-2 px-2 py-1 text-xs text-red-400/80 hover:text-red-400 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-all border border-red-500/10">🗑️ Xóa</button>
                    </h2>
                    <p className="text-sm text-gray-400 mt-0.5">
                      {selectedItem.category} • {formatPrice(selectedItem.price)}
                    </p>
                  </div>
                  <div>
                    <label className={labelCls}>Loại sản phẩm</label>
                    <select
                      className="px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500/50"
                      value={selectedItem.item_type || "goods"}
                      onChange={(e) =>
                        updateItemType(selectedItem.id, e.target.value)
                      }
                    >
                      <option value="goods" className="bg-gray-900 text-white">🏷️ Hàng hóa</option>
                      <option value="service" className="bg-gray-900 text-white">🎫 Dịch vụ</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Package includes (only for service) */}
              {selectedItem.item_type === "service" && (
                <div className={`${cardCls} p-5`}>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-base font-semibold text-white">
                        🎫 Vé tặng kèm (Trọn gói)
                      </h3>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Khi bán dịch vụ này, tự động tặng kèm các sản phẩm bên
                        dưới
                      </p>
                    </div>
                  </div>

                  {loadingPkg ? (
                    <div className="flex items-center justify-center py-6">
                      <div className="animate-spin h-5 w-5 border-2 border-emerald-500 border-t-transparent rounded-full" />
                    </div>
                  ) : (
                    <>
                      {/* Package table */}
                      {packages.length > 0 ? (
                        <div className="overflow-x-auto mb-4">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-gray-400 text-xs uppercase border-b border-white/5">
                                <th className="text-left pb-2 font-medium">
                                  Sản phẩm
                                </th>
                                <th className="text-center pb-2 font-medium">
                                  Số lượng
                                </th>
                                <th className="text-right pb-2 font-medium">
                                  Thao tác
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                              {packages.map((pkg) => (
                                <tr key={pkg.id}>
                                  <td className="py-3 text-white">
                                    {pkg.child_item?.name ||
                                      getItemName(pkg.child_menu_item_id)}
                                  </td>
                                  <td className="py-3 text-center text-gray-300">
                                    ×{pkg.quantity}
                                  </td>
                                  <td className="py-3 text-right">
                                    <button
                                      onClick={() =>
                                        removePackageInclude(pkg.id)
                                      }
                                      className="px-2.5 py-1 text-xs text-gray-400 hover:text-red-400 bg-white/5 hover:bg-red-500/10 rounded-lg transition-all"
                                    >
                                      🗑️ Xóa
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="text-gray-500 text-sm py-4 text-center mb-4">
                          Chưa có vé tặng kèm nào
                        </p>
                      )}

                      {/* Add form */}
                      <div className="flex gap-2 items-end p-3 bg-white/5 rounded-xl">
                        <div className="flex-1">
                          <label className={labelCls}>Chọn sản phẩm</label>
                          <select
                            className={inputCls}
                            value={addChildId}
                            onChange={(e) => setAddChildId(e.target.value)}
                          >
                            <option value="" className="bg-gray-900 text-white">-- Chọn --</option>
                            {childCandidates.map((c) => (
                              <option key={c.id} value={c.id} className="bg-gray-900 text-white">
                                {c.name} ({c.category})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="w-24">
                          <label className={labelCls}>SL</label>
                          <input
                            type="number"
                            min={1}
                            className={inputCls}
                            value={addChildQty}
                            onChange={(e) =>
                              setAddChildQty(parseInt(e.target.value) || 1)
                            }
                          />
                        </div>
                        <button
                          onClick={addPackageInclude}
                          disabled={!addChildId}
                          className="px-4 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded-xl text-sm font-medium transition-all whitespace-nowrap"
                        >
                          + Thêm
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Commission settings */}
              <div className={`${cardCls} p-5`}>
                <h3 className="text-base font-semibold text-white mb-1">
                  💰 Cài đặt hoa hồng
                </h3>
                <p className="text-xs text-gray-500 mb-4">
                  Cấu hình hoa hồng tài xế khi bán sản phẩm / dịch vụ này
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className={labelCls}>Loại hoa hồng</label>
                    <select
                      className={inputCls}
                      value={commType}
                      onChange={(e) =>
                        setCommType(e.target.value as "fixed" | "percentage")
                      }
                    >
                      <option value="fixed" className="bg-gray-900 text-white">💵 Cố định (VNĐ)</option>
                      <option value="percentage" className="bg-gray-900 text-white">📊 Phần trăm (%)</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>
                      {commType === "fixed" ? "Số tiền (VNĐ)" : "Tỷ lệ (%)"}
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={commType === "percentage" ? 0.1 : 1000}
                      className={inputCls}
                      value={commValue}
                      onChange={(e) =>
                        setCommValue(parseFloat(e.target.value) || 0)
                      }
                      placeholder={
                        commType === "fixed" ? "VD: 50000" : "VD: 10"
                      }
                    />
                  </div>
                </div>

                {commValue > 0 && (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl mb-4">
                    <p className="text-sm text-emerald-400">
                      💡 Mỗi lần bán &quot;{selectedItem.name}&quot;, tài xế sẽ nhận{" "}
                      <strong>
                        {commType === "fixed"
                          ? formatPrice(commValue)
                          : commValue + "% giá bán"}
                      </strong>{" "}
                      hoa hồng
                    </p>
                  </div>
                )}

                <div className="flex justify-end gap-3">
                  {commSettings.some(
                    (c) => c.menu_item_id === selectedId
                  ) && (
                    <button
                      onClick={deleteCommission}
                      className="px-4 py-2.5 bg-white/5 hover:bg-red-500/10 border border-white/10 hover:border-red-500/30 text-gray-300 hover:text-red-400 rounded-xl text-sm transition-all"
                    >
                      🗑️ Xóa hoa hồng
                    </button>
                  )}
                  <button
                    onClick={saveCommission}
                    disabled={savingComm || commValue <= 0}
                    className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition-all shadow-lg shadow-emerald-500/20"
                  >
                    {savingComm ? "Đang lưu..." : "💾 Lưu hoa hồng"}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-900 border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-xl font-semibold text-white mb-4">
              {editingId ? "Sửa Sản phẩm / Dịch vụ" : "Thêm Sản phẩm / Dịch vụ"}
            </h3>
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Tên</label>
                <input
                  className={inputCls}
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  placeholder="Nhập tên..."
                />
              </div>
              <div>
                <label className={labelCls}>Giá bán (VNĐ)</label>
                <input
                  type="number"
                  min={0}
                  className={inputCls}
                  value={addPrice}
                  onChange={(e) => setAddPrice(parseFloat(e.target.value) || 0)}
                />
              </div>
              <div>
                <label className={labelCls}>Phân loại</label>
                <select
                  className={inputCls}
                  value={addType}
                  onChange={(e) => setAddType(e.target.value as "goods" | "service")}
                >
                  <option value="goods" className="bg-gray-900 text-white">Hàng hóa</option>
                  <option value="service" className="bg-gray-900 text-white">Dịch vụ (Vé)</option>
                </select>
              </div>
              <div className="flex items-center gap-3 pt-2">
                <label className="text-sm font-medium text-gray-300">Cho phép bán (hiển thị trên POS)</label>
                <button
                  onClick={() => setAddAvailable(!addAvailable)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${addAvailable ? "bg-emerald-500" : "bg-gray-600"}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${addAvailable ? "translate-x-6" : "translate-x-1"}`} />
                </button>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={saveItem}
                disabled={addingItem || !addName.trim()}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
              >
                {addingItem ? "Đang lưu..." : "Lưu"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
