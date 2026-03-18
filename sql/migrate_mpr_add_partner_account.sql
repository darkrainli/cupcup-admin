-- 让 merchant_profile_change_requests 支持“未绑定门店账号”的建店申请
-- 适用于已存在旧表的环境

alter table public.merchant_profile_change_requests
  alter column bar_id drop not null;

alter table public.merchant_profile_change_requests
  add column if not exists partner_account_id uuid references public.partner_accounts(id) on delete set null;

create index if not exists idx_mpr_partner_account_id
  on public.merchant_profile_change_requests(partner_account_id);
