-- =============================================
-- ROM Phase 4: Shifts, Attendance & Payroll
-- Chạy SAU 01 & 02
-- =============================================

-- Ca làm việc (cấu hình theo chi nhánh)
CREATE TABLE public.shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,          -- VD: Ca sáng, Ca chiều, Ca tối
  start_time TIME NOT NULL,            -- 06:00
  end_time TIME NOT NULL,              -- 14:00
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Chấm công
CREATE TABLE public.attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  shift_id UUID REFERENCES public.shifts(id) ON DELETE SET NULL,
  work_date DATE NOT NULL,
  check_in_time TIMESTAMPTZ,
  check_out_time TIMESTAMPTZ,
  status VARCHAR(20) DEFAULT 'present',   -- present, absent, late, half_day, leave
  overtime_hours DECIMAL(4,1) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, work_date, shift_id)
);

-- Bảng lương
CREATE TABLE public.payroll (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  month INT NOT NULL,                      -- 1-12
  year INT NOT NULL,                       -- 2026
  base_salary DECIMAL(15,2) DEFAULT 0,
  total_work_days INT DEFAULT 0,
  total_overtime_hours DECIMAL(6,1) DEFAULT 0,
  overtime_pay DECIMAL(15,2) DEFAULT 0,
  bonus DECIMAL(15,2) DEFAULT 0,
  deductions DECIMAL(15,2) DEFAULT 0,
  net_salary DECIMAL(15,2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'draft',      -- draft, confirmed, paid
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, month, year)
);

-- Indexes
CREATE INDEX idx_shifts_branch ON public.shifts(branch_id);
CREATE INDEX idx_attendance_branch ON public.attendance(branch_id);
CREATE INDEX idx_attendance_user_date ON public.attendance(user_id, work_date);
CREATE INDEX idx_attendance_date ON public.attendance(branch_id, work_date);
CREATE INDEX idx_payroll_branch ON public.payroll(branch_id);
CREATE INDEX idx_payroll_user_month ON public.payroll(user_id, year, month);

-- RLS
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll ENABLE ROW LEVEL SECURITY;

-- Shifts policies
CREATE POLICY "shifts_select" ON public.shifts
  FOR SELECT USING (branch_id = public.get_user_branch_id());
CREATE POLICY "shifts_insert" ON public.shifts
  FOR INSERT WITH CHECK (branch_id = public.get_user_branch_id() AND public.get_user_role() IN ('admin', 'manager'));
CREATE POLICY "shifts_update" ON public.shifts
  FOR UPDATE USING (branch_id = public.get_user_branch_id() AND public.get_user_role() IN ('admin', 'manager'));

-- Attendance policies
CREATE POLICY "attendance_select" ON public.attendance
  FOR SELECT USING (branch_id = public.get_user_branch_id());
CREATE POLICY "attendance_insert" ON public.attendance
  FOR INSERT WITH CHECK (branch_id = public.get_user_branch_id());
CREATE POLICY "attendance_update" ON public.attendance
  FOR UPDATE USING (branch_id = public.get_user_branch_id() AND public.get_user_role() IN ('admin', 'manager'));

-- Payroll policies
CREATE POLICY "payroll_select" ON public.payroll
  FOR SELECT USING (
    branch_id = public.get_user_branch_id() AND
    (user_id = auth.uid() OR public.get_user_role() IN ('admin', 'manager'))
  );
CREATE POLICY "payroll_insert" ON public.payroll
  FOR INSERT WITH CHECK (branch_id = public.get_user_branch_id() AND public.get_user_role() IN ('admin', 'manager'));
CREATE POLICY "payroll_update" ON public.payroll
  FOR UPDATE USING (branch_id = public.get_user_branch_id() AND public.get_user_role() IN ('admin', 'manager'));

-- Updated_at triggers
CREATE TRIGGER trg_shifts_updated BEFORE UPDATE ON public.shifts FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER trg_attendance_updated BEFORE UPDATE ON public.attendance FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER trg_payroll_updated BEFORE UPDATE ON public.payroll FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Seed: Ca làm việc mẫu
INSERT INTO public.shifts (branch_id, name, start_time, end_time) VALUES
('a0000000-0000-0000-0000-000000000001', 'Ca sáng', '06:00', '14:00'),
('a0000000-0000-0000-0000-000000000001', 'Ca chiều', '14:00', '22:00'),
('a0000000-0000-0000-0000-000000000001', 'Ca tối', '22:00', '06:00');
