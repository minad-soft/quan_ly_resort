-- =============================================
-- ROM Phase 5: Vé trọn gói (Package Tickets) & Hoa hồng tài xế (Driver Commission)
-- Chạy SAU 01, 02, 03, 04
-- =============================================
-- Mục đích:
--   1. Cho phép tạo các món trọn gói (combo) gồm nhiều món con
--   2. Quản lý cấu hình hoa hồng cho tài xế theo từng sản phẩm/dịch vụ
--   3. Tạo & quản lý phiếu hoa hồng tự động khi có đơn hàng liên quan
-- =============================================


-- =============================================
-- 1. KIỂU ENUM MỚI
-- =============================================

-- Phân loại món: hàng hóa (goods) hoặc dịch vụ (service)
CREATE TYPE public.item_type AS ENUM ('goods', 'service');

-- Kiểu tính hoa hồng: cố định (fixed) hoặc phần trăm (percentage)
CREATE TYPE public.commission_type AS ENUM ('fixed', 'percentage');

-- Trạng thái phiếu hoa hồng: chờ thanh toán, đã thanh toán, đã hủy
CREATE TYPE public.commission_ticket_status AS ENUM ('pending', 'paid', 'cancelled');

-- Phương thức thanh toán hoa hồng: tiền mặt hoặc chuyển khoản
CREATE TYPE public.commission_payment_method AS ENUM ('cash', 'transfer');


-- =============================================
-- 2. BỔ SUNG CỘT item_type CHO BẢNG menu_items
-- =============================================
-- Mặc định 'goods' để tương thích ngược với dữ liệu cũ
ALTER TABLE public.menu_items ADD COLUMN item_type public.item_type DEFAULT 'goods';


-- =============================================
-- 3. BẢNG package_includes — Cấu hình món con trong gói trọn gói
-- =============================================
-- Mỗi bản ghi thể hiện: món cha (parent_item_id) chứa món con (child_item_id)
-- với số lượng (quantity) tương ứng.
-- VD: Gói "Vé tham quan trọn gói" gồm: 1 vé vào cổng + 2 vé xe điện + 1 bữa trưa
CREATE TABLE public.package_includes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  parent_item_id UUID NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  child_item_id UUID NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  quantity INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  -- Mỗi cặp cha-con chỉ xuất hiện 1 lần
  UNIQUE(parent_item_id, child_item_id)
);


-- =============================================
-- 4. BẢNG commission_settings — Cấu hình mức hoa hồng theo sản phẩm
-- =============================================
-- Mỗi bản ghi quy định mức hoa hồng cho 1 sản phẩm/dịch vụ tại 1 chi nhánh.
-- commission_type: 'fixed' = số tiền cố định, 'percentage' = % trên giá bán
-- commission_value: giá trị tương ứng (VND hoặc %)
CREATE TABLE public.commission_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  menu_item_id UUID NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  commission_type public.commission_type NOT NULL DEFAULT 'fixed',
  commission_value DECIMAL(15,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  -- Mỗi sản phẩm chỉ có 1 cấu hình hoa hồng tại mỗi chi nhánh
  UNIQUE(branch_id, menu_item_id)
);


-- =============================================
-- 5. BẢNG commission_tickets — Phiếu hoa hồng tài xế
-- =============================================
-- Mỗi phiếu ghi nhận 1 khoản hoa hồng cho tài xế khi dẫn khách.
-- Mã phiếu (code) được tự động sinh ra bằng trigger, an toàn cho máy quét barcode.
CREATE TABLE public.commission_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  code VARCHAR(20) NOT NULL UNIQUE,                                         -- Mã phiếu, tự sinh: HH-XXXXXX
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,    -- Đơn hàng liên quan
  menu_item_id UUID REFERENCES public.menu_items(id) ON DELETE SET NULL,    -- Sản phẩm/dịch vụ tính hoa hồng
  driver_name VARCHAR(255) NOT NULL,                                        -- Tên tài xế
  driver_phone VARCHAR(20) NOT NULL,                                        -- Số điện thoại tài xế
  amount DECIMAL(15,2) NOT NULL,                                            -- Số tiền hoa hồng (VND)
  status public.commission_ticket_status DEFAULT 'pending',                 -- Trạng thái
  payment_method public.commission_payment_method,                          -- Phương thức thanh toán
  paid_at TIMESTAMPTZ,                                                      -- Thời điểm thanh toán
  paid_by UUID REFERENCES public.users(id),                                 -- Người thanh toán
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,           -- Người tạo phiếu
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);


-- =============================================
-- 6. HÀM SINH MÃ PHIẾU HOA HỒNG AN TOÀN
-- =============================================
-- Loại bỏ các ký tự dễ nhầm lẫn khi quét barcode hoặc gõ Telex:
--   I, l, O, 0, D, W, S, F, R, X, J (và chữ thường tương ứng)
-- Chỉ sử dụng ký tự an toàn:
--   A, B, C, E, G, H, K, M, N, P, Q, T, U, V, Y, Z, 1, 2, 3, 4, 5, 6, 7, 8, 9
-- Định dạng: HH-XXXXXX (HH = Hoa Hồng, 6 ký tự ngẫu nhiên an toàn)
CREATE OR REPLACE FUNCTION public.generate_commission_code()
RETURNS TEXT AS $$
DECLARE
  safe_chars TEXT := 'ABCEGHKMNPQTUVYZ123456789';
  result TEXT := 'HH-';
  i INT;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(safe_chars, floor(random() * length(safe_chars) + 1)::int, 1);
  END LOOP;

  -- Kiểm tra trùng mã, nếu trùng thì thử lại (đệ quy)
  IF EXISTS (SELECT 1 FROM public.commission_tickets WHERE code = result) THEN
    RETURN public.generate_commission_code();
  END IF;

  RETURN result;
END;
$$ LANGUAGE plpgsql;


-- =============================================
-- 7. TRIGGER TỰ ĐỘNG SINH MÃ PHIẾU HOA HỒNG
-- =============================================
-- Khi INSERT vào commission_tickets mà code = NULL hoặc rỗng,
-- trigger sẽ tự gọi hàm generate_commission_code() để sinh mã.
CREATE OR REPLACE FUNCTION public.trg_commission_code_fn()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.code IS NULL OR NEW.code = '' THEN
    NEW.code := public.generate_commission_code();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_auto_commission_code
  BEFORE INSERT ON public.commission_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_commission_code_fn();


-- =============================================
-- 8. CHỈ MỤC (INDEXES)
-- =============================================

-- package_includes: tìm nhanh các món con của 1 món cha, lọc theo chi nhánh
CREATE INDEX idx_package_parent ON public.package_includes(parent_item_id);
CREATE INDEX idx_package_branch ON public.package_includes(branch_id);

-- commission_settings: lọc nhanh cấu hình đang hoạt động theo chi nhánh, theo sản phẩm
CREATE INDEX idx_commission_settings_branch ON public.commission_settings(branch_id, is_active);
CREATE INDEX idx_commission_settings_menu ON public.commission_settings(menu_item_id);

-- commission_tickets: lọc theo trạng thái, tìm theo mã, theo đơn hàng
CREATE INDEX idx_commission_tickets_branch ON public.commission_tickets(branch_id, status);
CREATE INDEX idx_commission_tickets_code ON public.commission_tickets(code);
CREATE INDEX idx_commission_tickets_order ON public.commission_tickets(order_id);

-- menu_items: lọc nhanh theo loại (goods/service) trong chi nhánh
CREATE INDEX idx_menu_items_type ON public.menu_items(branch_id, item_type);


-- =============================================
-- 9. TRIGGER CẬP NHẬT updated_at
-- =============================================
-- Sử dụng hàm handle_updated_at() đã có từ migration 02
CREATE TRIGGER trg_package_includes_updated BEFORE UPDATE ON public.package_includes FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER trg_commission_settings_updated BEFORE UPDATE ON public.commission_settings FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER trg_commission_tickets_updated BEFORE UPDATE ON public.commission_tickets FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- =============================================
-- 10. ROW LEVEL SECURITY (RLS)
-- =============================================

-- Bật RLS cho tất cả bảng mới
ALTER TABLE public.package_includes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_tickets ENABLE ROW LEVEL SECURITY;

-- ========== package_includes — Cấu hình gói trọn gói ==========
-- SELECT: Nhân viên cùng chi nhánh có thể xem
CREATE POLICY "pkg_includes_select" ON public.package_includes
  FOR SELECT USING (branch_id = public.get_user_branch_id());

-- INSERT: Chỉ admin/manager mới được thêm
CREATE POLICY "pkg_includes_insert" ON public.package_includes
  FOR INSERT WITH CHECK (branch_id = public.get_user_branch_id() AND public.get_user_role() IN ('admin', 'manager'));

-- UPDATE: Chỉ admin/manager mới được sửa
CREATE POLICY "pkg_includes_update" ON public.package_includes
  FOR UPDATE USING (branch_id = public.get_user_branch_id() AND public.get_user_role() IN ('admin', 'manager'));

-- DELETE: Chỉ admin/manager mới được xóa
CREATE POLICY "pkg_includes_delete" ON public.package_includes
  FOR DELETE USING (branch_id = public.get_user_branch_id() AND public.get_user_role() IN ('admin', 'manager'));

-- ========== commission_settings — Cấu hình hoa hồng ==========
-- SELECT: Nhân viên cùng chi nhánh có thể xem
CREATE POLICY "commission_settings_select" ON public.commission_settings
  FOR SELECT USING (branch_id = public.get_user_branch_id());

-- INSERT: Chỉ admin/manager mới được thêm cấu hình
CREATE POLICY "commission_settings_insert" ON public.commission_settings
  FOR INSERT WITH CHECK (branch_id = public.get_user_branch_id() AND public.get_user_role() IN ('admin', 'manager'));

-- UPDATE: Chỉ admin/manager mới được sửa cấu hình
CREATE POLICY "commission_settings_update" ON public.commission_settings
  FOR UPDATE USING (branch_id = public.get_user_branch_id() AND public.get_user_role() IN ('admin', 'manager'));

-- DELETE: Chỉ admin/manager mới được xóa cấu hình
CREATE POLICY "commission_settings_delete" ON public.commission_settings
  FOR DELETE USING (branch_id = public.get_user_branch_id() AND public.get_user_role() IN ('admin', 'manager'));

-- ========== commission_tickets — Phiếu hoa hồng tài xế ==========
-- SELECT: Nhân viên cùng chi nhánh có thể xem phiếu
CREATE POLICY "commission_tickets_select" ON public.commission_tickets
  FOR SELECT USING (branch_id = public.get_user_branch_id());

-- INSERT: Tất cả nhân viên (trừ customer) có thể tạo phiếu hoa hồng
CREATE POLICY "commission_tickets_insert" ON public.commission_tickets
  FOR INSERT WITH CHECK (branch_id = public.get_user_branch_id() AND public.get_user_role() NOT IN ('customer'));

-- UPDATE: Admin, manager, cashier có thể cập nhật (thanh toán/hủy phiếu)
CREATE POLICY "commission_tickets_update" ON public.commission_tickets
  FOR UPDATE USING (branch_id = public.get_user_branch_id() AND public.get_user_role() IN ('admin', 'manager', 'cashier'));

-- DELETE: Chỉ admin/manager mới được xóa phiếu
CREATE POLICY "commission_tickets_delete" ON public.commission_tickets
  FOR DELETE USING (branch_id = public.get_user_branch_id() AND public.get_user_role() IN ('admin', 'manager'));
