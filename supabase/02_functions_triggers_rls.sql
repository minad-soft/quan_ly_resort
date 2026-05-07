-- =============================================
-- ROM - Functions, Triggers, Indexes & RLS
-- Run AFTER 01_database_schema.sql
-- =============================================

-- =============================================
-- 3. HELPER FUNCTIONS
-- =============================================

-- Lấy branch_id của user hiện tại
CREATE OR REPLACE FUNCTION public.get_user_branch_id()
RETURNS UUID AS $$
  SELECT branch_id FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Lấy role của user hiện tại
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS public.user_role AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Tự sinh mã hóa đơn: ORD-YYMMDD-0001
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS TRIGGER AS $$
DECLARE
  seq_num INT;
  dp TEXT;
BEGIN
  dp := to_char(now(), 'YYMMDD');
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(order_number FROM 'ORD-' || dp || '-(\d+)') AS INT)
  ), 0) + 1 INTO seq_num
  FROM public.orders
  WHERE order_number LIKE 'ORD-' || dp || '-%';
  NEW.order_number := 'ORD-' || dp || '-' || LPAD(seq_num::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Cập nhật trạng thái phòng khi booking thay đổi
CREATE OR REPLACE FUNCTION public.handle_booking_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'checked_in' AND (OLD.status IS NULL OR OLD.status != 'checked_in') THEN
    UPDATE public.rooms SET status = 'occupied', updated_at = now() WHERE id = NEW.room_id;
    NEW.actual_check_in := COALESCE(NEW.actual_check_in, now());
  ELSIF NEW.status = 'checked_out' AND OLD.status = 'checked_in' THEN
    UPDATE public.rooms SET status = 'cleaning', updated_at = now() WHERE id = NEW.room_id;
    NEW.actual_check_out := COALESCE(NEW.actual_check_out, now());
  ELSIF NEW.status = 'cancelled' AND OLD.status IN ('pending', 'confirmed') THEN
    UPDATE public.rooms SET status = 'available', updated_at = now() WHERE id = NEW.room_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Cập nhật payment_status trên order khi có payment mới
CREATE OR REPLACE FUNCTION public.handle_payment_update()
RETURNS TRIGGER AS $$
DECLARE
  total_paid DECIMAL(15,2);
  order_amount DECIMAL(15,2);
  target_id UUID;
BEGIN
  target_id := COALESCE(NEW.order_id, OLD.order_id);
  IF target_id IS NULL THEN RETURN NEW; END IF;

  SELECT COALESCE(SUM(amount), 0) INTO total_paid
  FROM public.payments WHERE order_id = target_id AND status = 'success';

  SELECT final_amount INTO order_amount
  FROM public.orders WHERE id = target_id;

  UPDATE public.orders SET
    payment_status = CASE
      WHEN total_paid >= order_amount THEN 'paid'::public.payment_status_enum
      WHEN total_paid > 0 THEN 'partial'::public.payment_status_enum
      ELSE 'unpaid'::public.payment_status_enum
    END,
    updated_at = now()
  WHERE id = target_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Auto updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- 4. TRIGGERS
-- =============================================

CREATE TRIGGER trg_auto_order_number
  BEFORE INSERT ON public.orders
  FOR EACH ROW WHEN (NEW.order_number IS NULL)
  EXECUTE FUNCTION public.generate_order_number();

CREATE TRIGGER trg_booking_status_change
  BEFORE UPDATE OF status ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_booking_status_change();

CREATE TRIGGER trg_payment_update
  AFTER INSERT OR UPDATE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_payment_update();

-- updated_at triggers
CREATE TRIGGER trg_branches_updated BEFORE UPDATE ON public.branches FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER trg_bank_accounts_updated BEFORE UPDATE ON public.branch_bank_accounts FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER trg_users_updated BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER trg_room_types_updated BEFORE UPDATE ON public.room_types FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER trg_rooms_updated BEFORE UPDATE ON public.rooms FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER trg_guests_updated BEFORE UPDATE ON public.guests FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER trg_bookings_updated BEFORE UPDATE ON public.bookings FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER trg_inventory_updated BEFORE UPDATE ON public.inventory_items FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER trg_menu_items_updated BEFORE UPDATE ON public.menu_items FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER trg_orders_updated BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER trg_payment_methods_updated BEFORE UPDATE ON public.branch_payment_methods FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =============================================
-- 5. INDEXES
-- =============================================

CREATE INDEX idx_users_branch ON public.users(branch_id);
CREATE INDEX idx_rooms_branch_status ON public.rooms(branch_id, status);
CREATE INDEX idx_room_types_branch ON public.room_types(branch_id);
CREATE INDEX idx_guests_branch ON public.guests(branch_id);
CREATE INDEX idx_guests_id_number ON public.guests(branch_id, id_number);
CREATE INDEX idx_bookings_branch_dates ON public.bookings(branch_id, check_in_date, check_out_date);
CREATE INDEX idx_bookings_branch_status ON public.bookings(branch_id, status);
CREATE INDEX idx_bookings_room ON public.bookings(room_id);
CREATE INDEX idx_bookings_guest ON public.bookings(guest_id);
CREATE INDEX idx_inventory_branch ON public.inventory_items(branch_id, is_active);
CREATE INDEX idx_menu_items_branch ON public.menu_items(branch_id, is_available);
CREATE INDEX idx_bom_menu ON public.bom_recipes(menu_item_id);
CREATE INDEX idx_bom_inventory ON public.bom_recipes(inventory_item_id);
CREATE INDEX idx_orders_branch_created ON public.orders(branch_id, created_at DESC);
CREATE INDEX idx_orders_branch_payment ON public.orders(branch_id, payment_status);
CREATE INDEX idx_orders_booking ON public.orders(booking_id);
CREATE INDEX idx_order_details_order ON public.order_details(order_id);
CREATE INDEX idx_payments_order ON public.payments(order_id);
CREATE INDEX idx_payments_booking ON public.payments(booking_id);
CREATE INDEX idx_payments_branch ON public.payments(branch_id);
CREATE INDEX idx_inv_tx_item ON public.inventory_transactions(inventory_item_id, created_at DESC);
CREATE INDEX idx_inv_tx_branch ON public.inventory_transactions(branch_id);
CREATE INDEX idx_bank_accounts_branch ON public.branch_bank_accounts(branch_id);
CREATE INDEX idx_payment_methods_branch ON public.branch_payment_methods(branch_id, is_active);

-- =============================================
-- 6. ROW LEVEL SECURITY (RLS)
-- =============================================

-- Enable RLS
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branch_bank_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bom_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branch_payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;

-- ========== branches ==========
CREATE POLICY "branches_select" ON public.branches
  FOR SELECT USING (id = public.get_user_branch_id());
CREATE POLICY "branches_update" ON public.branches
  FOR UPDATE USING (id = public.get_user_branch_id() AND public.get_user_role() IN ('admin', 'manager'));

-- ========== branch_bank_accounts ==========
CREATE POLICY "bank_select" ON public.branch_bank_accounts
  FOR SELECT USING (branch_id = public.get_user_branch_id());
CREATE POLICY "bank_insert" ON public.branch_bank_accounts
  FOR INSERT WITH CHECK (branch_id = public.get_user_branch_id() AND public.get_user_role() IN ('admin', 'manager'));
CREATE POLICY "bank_update" ON public.branch_bank_accounts
  FOR UPDATE USING (branch_id = public.get_user_branch_id() AND public.get_user_role() IN ('admin', 'manager'));
CREATE POLICY "bank_delete" ON public.branch_bank_accounts
  FOR DELETE USING (branch_id = public.get_user_branch_id() AND public.get_user_role() IN ('admin', 'manager'));

-- ========== users ==========
CREATE POLICY "users_select" ON public.users
  FOR SELECT USING (branch_id = public.get_user_branch_id());
CREATE POLICY "users_insert" ON public.users
  FOR INSERT WITH CHECK (branch_id = public.get_user_branch_id() AND public.get_user_role() IN ('admin', 'manager'));
CREATE POLICY "users_update" ON public.users
  FOR UPDATE USING (id = auth.uid() OR (branch_id = public.get_user_branch_id() AND public.get_user_role() IN ('admin', 'manager')));

-- ========== room_types ==========
CREATE POLICY "room_types_select" ON public.room_types
  FOR SELECT USING (branch_id = public.get_user_branch_id());
CREATE POLICY "room_types_insert" ON public.room_types
  FOR INSERT WITH CHECK (branch_id = public.get_user_branch_id() AND public.get_user_role() IN ('admin', 'manager'));
CREATE POLICY "room_types_update" ON public.room_types
  FOR UPDATE USING (branch_id = public.get_user_branch_id() AND public.get_user_role() IN ('admin', 'manager'));
CREATE POLICY "room_types_delete" ON public.room_types
  FOR DELETE USING (branch_id = public.get_user_branch_id() AND public.get_user_role() IN ('admin', 'manager'));

-- ========== rooms ==========
CREATE POLICY "rooms_select" ON public.rooms
  FOR SELECT USING (branch_id = public.get_user_branch_id());
CREATE POLICY "rooms_insert" ON public.rooms
  FOR INSERT WITH CHECK (branch_id = public.get_user_branch_id() AND public.get_user_role() IN ('admin', 'manager'));
CREATE POLICY "rooms_update" ON public.rooms
  FOR UPDATE USING (branch_id = public.get_user_branch_id() AND public.get_user_role() NOT IN ('customer'));
CREATE POLICY "rooms_delete" ON public.rooms
  FOR DELETE USING (branch_id = public.get_user_branch_id() AND public.get_user_role() IN ('admin', 'manager'));

-- ========== guests ==========
CREATE POLICY "guests_select" ON public.guests
  FOR SELECT USING (branch_id = public.get_user_branch_id());
CREATE POLICY "guests_insert" ON public.guests
  FOR INSERT WITH CHECK (branch_id = public.get_user_branch_id());
CREATE POLICY "guests_update" ON public.guests
  FOR UPDATE USING (branch_id = public.get_user_branch_id() AND public.get_user_role() NOT IN ('customer'));
CREATE POLICY "guests_delete" ON public.guests
  FOR DELETE USING (branch_id = public.get_user_branch_id() AND public.get_user_role() IN ('admin', 'manager'));

-- ========== bookings ==========
CREATE POLICY "bookings_select" ON public.bookings
  FOR SELECT USING (branch_id = public.get_user_branch_id());
CREATE POLICY "bookings_insert" ON public.bookings
  FOR INSERT WITH CHECK (branch_id = public.get_user_branch_id());
CREATE POLICY "bookings_update" ON public.bookings
  FOR UPDATE USING (branch_id = public.get_user_branch_id() AND public.get_user_role() NOT IN ('customer'));
CREATE POLICY "bookings_delete" ON public.bookings
  FOR DELETE USING (branch_id = public.get_user_branch_id() AND public.get_user_role() IN ('admin', 'manager'));

-- ========== inventory_items ==========
CREATE POLICY "inventory_select" ON public.inventory_items
  FOR SELECT USING (branch_id = public.get_user_branch_id() AND public.get_user_role() NOT IN ('customer'));
CREATE POLICY "inventory_insert" ON public.inventory_items
  FOR INSERT WITH CHECK (branch_id = public.get_user_branch_id() AND public.get_user_role() IN ('admin', 'manager', 'kitchen'));
CREATE POLICY "inventory_update" ON public.inventory_items
  FOR UPDATE USING (branch_id = public.get_user_branch_id() AND public.get_user_role() IN ('admin', 'manager', 'kitchen'));
CREATE POLICY "inventory_delete" ON public.inventory_items
  FOR DELETE USING (branch_id = public.get_user_branch_id() AND public.get_user_role() IN ('admin', 'manager'));

-- ========== menu_items ==========
CREATE POLICY "menu_select" ON public.menu_items
  FOR SELECT USING (branch_id = public.get_user_branch_id());
CREATE POLICY "menu_insert" ON public.menu_items
  FOR INSERT WITH CHECK (branch_id = public.get_user_branch_id() AND public.get_user_role() IN ('admin', 'manager'));
CREATE POLICY "menu_update" ON public.menu_items
  FOR UPDATE USING (branch_id = public.get_user_branch_id() AND public.get_user_role() IN ('admin', 'manager'));
CREATE POLICY "menu_delete" ON public.menu_items
  FOR DELETE USING (branch_id = public.get_user_branch_id() AND public.get_user_role() IN ('admin', 'manager'));

-- ========== bom_recipes (qua JOIN menu_items) ==========
CREATE POLICY "bom_select" ON public.bom_recipes
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.menu_items WHERE id = bom_recipes.menu_item_id AND branch_id = public.get_user_branch_id()
  ));
CREATE POLICY "bom_insert" ON public.bom_recipes
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM public.menu_items WHERE id = bom_recipes.menu_item_id AND branch_id = public.get_user_branch_id()
  ) AND public.get_user_role() IN ('admin', 'manager'));
CREATE POLICY "bom_update" ON public.bom_recipes
  FOR UPDATE USING (EXISTS (
    SELECT 1 FROM public.menu_items WHERE id = bom_recipes.menu_item_id AND branch_id = public.get_user_branch_id()
  ) AND public.get_user_role() IN ('admin', 'manager'));
CREATE POLICY "bom_delete" ON public.bom_recipes
  FOR DELETE USING (EXISTS (
    SELECT 1 FROM public.menu_items WHERE id = bom_recipes.menu_item_id AND branch_id = public.get_user_branch_id()
  ) AND public.get_user_role() IN ('admin', 'manager'));

-- ========== orders ==========
CREATE POLICY "orders_select" ON public.orders
  FOR SELECT USING (branch_id = public.get_user_branch_id());
CREATE POLICY "orders_insert" ON public.orders
  FOR INSERT WITH CHECK (branch_id = public.get_user_branch_id());
CREATE POLICY "orders_update" ON public.orders
  FOR UPDATE USING (branch_id = public.get_user_branch_id() AND public.get_user_role() NOT IN ('customer'));
CREATE POLICY "orders_delete" ON public.orders
  FOR DELETE USING (branch_id = public.get_user_branch_id() AND public.get_user_role() IN ('admin', 'manager'));

-- ========== order_details (qua JOIN orders) ==========
CREATE POLICY "details_select" ON public.order_details
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.orders WHERE id = order_details.order_id AND branch_id = public.get_user_branch_id()
  ));
CREATE POLICY "details_insert" ON public.order_details
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM public.orders WHERE id = order_details.order_id AND branch_id = public.get_user_branch_id()
  ));
CREATE POLICY "details_update" ON public.order_details
  FOR UPDATE USING (EXISTS (
    SELECT 1 FROM public.orders WHERE id = order_details.order_id AND branch_id = public.get_user_branch_id()
  ) AND public.get_user_role() NOT IN ('customer'));
CREATE POLICY "details_delete" ON public.order_details
  FOR DELETE USING (EXISTS (
    SELECT 1 FROM public.orders WHERE id = order_details.order_id AND branch_id = public.get_user_branch_id()
  ) AND public.get_user_role() IN ('admin', 'manager'));

-- ========== branch_payment_methods ==========
CREATE POLICY "pm_select" ON public.branch_payment_methods
  FOR SELECT USING (branch_id = public.get_user_branch_id());
CREATE POLICY "pm_insert" ON public.branch_payment_methods
  FOR INSERT WITH CHECK (branch_id = public.get_user_branch_id() AND public.get_user_role() IN ('admin', 'manager'));
CREATE POLICY "pm_update" ON public.branch_payment_methods
  FOR UPDATE USING (branch_id = public.get_user_branch_id() AND public.get_user_role() IN ('admin', 'manager'));
CREATE POLICY "pm_delete" ON public.branch_payment_methods
  FOR DELETE USING (branch_id = public.get_user_branch_id() AND public.get_user_role() IN ('admin', 'manager'));

-- ========== payments ==========
CREATE POLICY "payments_select" ON public.payments
  FOR SELECT USING (branch_id = public.get_user_branch_id());
CREATE POLICY "payments_insert" ON public.payments
  FOR INSERT WITH CHECK (branch_id = public.get_user_branch_id());
CREATE POLICY "payments_update" ON public.payments
  FOR UPDATE USING (branch_id = public.get_user_branch_id() AND public.get_user_role() NOT IN ('customer'));

-- ========== inventory_transactions ==========
CREATE POLICY "inv_tx_select" ON public.inventory_transactions
  FOR SELECT USING (branch_id = public.get_user_branch_id() AND public.get_user_role() NOT IN ('customer'));
CREATE POLICY "inv_tx_insert" ON public.inventory_transactions
  FOR INSERT WITH CHECK (branch_id = public.get_user_branch_id() AND public.get_user_role() NOT IN ('customer'));
