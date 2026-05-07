"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

export default function InventoryPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchInventory = async () => {
      try {
        // Use Supabase directly since we need service role for inventory
        const result = await apiFetch("/api/menu?category=all");
        // For now, show a placeholder - inventory API needs to be added
        setItems([]);
      } catch (err) {
        console.error("Failed to fetch inventory:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchInventory();
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Quản lý kho</h1>
        <p className="text-gray-400 text-sm mt-1">Theo dõi tồn kho & cảnh báo hết hàng</p>
      </div>

      <div className="glass-card p-12 text-center">
        <p className="text-5xl mb-4">📦</p>
        <h3 className="text-lg font-medium text-white mb-2">Module Kho</h3>
        <p className="text-gray-400 text-sm">
          Tính năng quản lý kho sẽ được phát triển đầy đủ ở Phase 4.
          <br />
          Hiện tại, kho được trừ tự động qua BOM khi tạo order tại POS.
        </p>
      </div>
    </div>
  );
}
