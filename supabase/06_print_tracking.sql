-- Thêm cột theo dõi số lần in
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS invoice_print_count INT DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS ticket_print_count INT DEFAULT 0;
