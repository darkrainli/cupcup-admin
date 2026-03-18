-- 商户资料审核日志（最小审计链路）
create table if not exists public.merchant_profile_review_logs (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.merchant_profile_change_requests(id) on delete cascade,
  action text not null check (action in ('submit', 'approve', 'reject')),
  operator_role text not null check (operator_role in ('partner', 'admin', 'system')),
  operator_id text,
  operator_email text,
  before_status text check (before_status in ('pending', 'approved', 'rejected')),
  after_status text check (after_status in ('pending', 'approved', 'rejected')),
  comment text,
  request_type text check (request_type in ('create', 'update')),
  bar_id text,
  partner_account_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists idx_mpr_logs_request_id on public.merchant_profile_review_logs(request_id);
create index if not exists idx_mpr_logs_created_at on public.merchant_profile_review_logs(created_at desc);
