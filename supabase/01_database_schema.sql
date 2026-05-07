-- =============================================
-- ROM (Resort Operations Manager) - Database Schema
-- Supabase PostgreSQL
-- Version: 1.0 | Date: 2026-05-08
-- =============================================

-- =============================================
-- 1. ENUM TYPES
-- =============================================
CREATE TYPE public.user_role AS ENUM (
  'admin', 'manager', 'receptionist', 'housekeeping', 'kitchen', 'cashier', 'customer'
);

CREATE TYPE public.room_status AS ENUM (
  'available', 'occupied', 'cleaning', 'maintenance', 'out_of_service'
);

CREATE TYPE public.booking_status AS ENUM (
  'pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show'
);

CREATE TYPE public.order_type AS ENUM (
  'fnb', 'service', 'retail', 'room_charge'
);

CREATE TYPE public.order_status AS ENUM (
  'pending', 'preparing', 'completed', 'cancelled'
);

CREATE TYPE public.payment_status_enum AS ENUM (
  'unpaid', 'partial', 'paid'
);

CREATE TYPE public.payment_method_type AS ENUM (
  'cash', 'bank_transfer', 'card', 'e_wallet', 'other'
);

CREATE TYPE public.inv_transaction_type AS ENUM (
  'stock_in', 'stock_out', 'adjustment', 'bom_deduction'
);

-- =============================================
-- 2. TABLES
-- =============================================

-- 2.1 Chi nhánh
CREATE TABLE public.branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  address TEXT,
  phone VARCHAR(20),
  email VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2.2 Tài khoản ngân hàng chi nhánh (Sepay webhook)
CREATE TABLE public.branch_bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  bank_name VARCHAR(255) NOT NULL,
  bank_code VARCHAR(20),
  account_number VARCHAR(50) NOT NULL,
  account_holder VARCHAR(255) NOT NULL,
  is_primary BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  sepay_api_key TEXT,
  sepay_webhook_secret TEXT,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2.3 Nhân sự (liên kết Supabase Auth)
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(20),
  role public.user_role NOT NULL DEFAULT 'customer',
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2.4 Loại phòng (tùy biến theo chi nhánh)
CREATE TABLE public.room_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  base_price DECIMAL(15,2) NOT NULL DEFAULT 0,
  max_occupancy INT DEFAULT 2,
  amenities JSONB DEFAULT '[]',
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(branch_id, name)
);

-- 2.5 Phòng lưu trú
CREATE TABLE public.rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  room_type_id UUID REFERENCES public.room_types(id) ON DELETE SET NULL,
  room_number VARCHAR(20) NOT NULL,
  floor INT,
  status public.room_status DEFAULT 'available',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(branch_id, room_number)
);

-- 2.6 Khách lưu trú
CREATE TABLE public.guests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  full_name VARCHAR(255) NOT NULL,
  id_number VARCHAR(50),
  phone VARCHAR(20),
  email VARCHAR(255),
  nationality VARCHAR(100) DEFAULT 'Việt Nam',
  date_of_birth DATE,
  address TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2.7 Đặt phòng / Check-in
CREATE TABLE public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE RESTRICT,
  guest_id UUID NOT NULL REFERENCES public.guests(id) ON DELETE RESTRICT,
  check_in_date TIMESTAMPTZ NOT NULL,
  check_out_date TIMESTAMPTZ NOT NULL,
  actual_check_in TIMESTAMPTZ,
  actual_check_out TIMESTAMPTZ,
  num_guests INT DEFAULT 1,
  room_rate DECIMAL(15,2) NOT NULL,
  total_amount DECIMAL(15,2) DEFAULT 0,
  status public.booking_status DEFAULT 'pending',
  source VARCHAR(50) DEFAULT 'walk_in',
  notes TEXT,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT chk_booking_dates CHECK (check_out_date > check_in_date)
);

-- 2.8 Nguyên vật liệu kho
CREATE TABLE public.inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  unit VARCHAR(50) NOT NULL,
  quantity_on_hand DECIMAL(15,3) DEFAULT 0,
  min_stock_level DECIMAL(15,3) DEFAULT 0,
  cost_per_unit DECIMAL(15,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2.9 Thực đơn F&B / Sản phẩm bán lẻ
CREATE TABLE public.menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  price DECIMAL(15,2) NOT NULL DEFAULT 0,
  description TEXT,
  image_url TEXT,
  is_available BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2.10 Định mức nguyên liệu (BOM)
CREATE TABLE public.bom_recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id UUID NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  inventory_item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
  quantity_needed DECIMAL(15,3) NOT NULL,
  unit VARCHAR(50),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(menu_item_id, inventory_item_id)
);

-- 2.11 Hóa đơn dịch vụ
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  order_number VARCHAR(50) UNIQUE,
  order_type public.order_type DEFAULT 'fnb',
  status public.order_status DEFAULT 'pending',
  total_amount DECIMAL(15,2) DEFAULT 0,
  discount_amount DECIMAL(15,2) DEFAULT 0,
  final_amount DECIMAL(15,2) DEFAULT 0,
  payment_status public.payment_status_enum DEFAULT 'unpaid',
  notes TEXT,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2.12 Chi tiết hóa đơn
CREATE TABLE public.order_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  menu_item_id UUID NOT NULL REFERENCES public.menu_items(id) ON DELETE RESTRICT,
  quantity DECIMAL(10,2) NOT NULL,
  unit_price DECIMAL(15,2) NOT NULL,
  subtotal DECIMAL(15,2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2.13 Phương thức thanh toán (cấu hình theo chi nhánh)
CREATE TABLE public.branch_payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  method_type public.payment_method_type NOT NULL,
  bank_account_id UUID REFERENCES public.branch_bank_accounts(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  allow_online BOOLEAN DEFAULT false,
  sort_order INT DEFAULT 0,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2.14 Thanh toán (hỗ trợ split payment - nhiều giao dịch/đơn)
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
  payment_method_id UUID REFERENCES public.branch_payment_methods(id) ON DELETE SET NULL,
  amount DECIMAL(15,2) NOT NULL,
  transaction_ref VARCHAR(255),
  status VARCHAR(50) DEFAULT 'pending',
  verified_at TIMESTAMPTZ,
  verified_by UUID REFERENCES public.users(id),
  notes TEXT,
  paid_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2.15 Log xuất/nhập kho (BOM Logging)
CREATE TABLE public.inventory_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  inventory_item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
  transaction_type public.inv_transaction_type NOT NULL,
  quantity DECIMAL(15,3) NOT NULL,
  balance_after DECIMAL(15,3),
  reference_type VARCHAR(50),
  reference_id UUID,
  notes TEXT,
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
