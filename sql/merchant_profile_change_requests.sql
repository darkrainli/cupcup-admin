-- 商户资料审核单（v1）
-- 用途：商户提交资料变更后先入审核单，管理员审核通过后再写入 bars

create table if not exists public.merchant_profile_change_requests (
  id uuid primary key default gen_random_uuid(),
  bar_id uuid references public.bars(id) on delete set null,
  partner_account_id uuid references public.partner_accounts(id) on delete set null,
  request_type text not null default 'update' check (request_type in ('create', 'update')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  payload jsonb not null default '{}'::jsonb,
  submitted_by_email text,
  review_comment text,
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_mpr_bar_id on public.merchant_profile_change_requests(bar_id);
create index if not exists idx_mpr_partner_account_id on public.merchant_profile_change_requests(partner_account_id);
create index if not exists idx_mpr_status on public.merchant_profile_change_requests(status);
create index if not exists idx_mpr_created_at on public.merchant_profile_change_requests(created_at desc);

create or replace function public.set_mpr_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_mpr_updated_at on public.merchant_profile_change_requests;
create trigger trg_mpr_updated_at
before update on public.merchant_profile_change_requests
for each row execute function public.set_mpr_updated_at();
