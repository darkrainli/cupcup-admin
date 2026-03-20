-- Partner RLS 基础收口
-- 适用：已上线 /api/partner-login 且配置 MEMFIRE_JWT_SECRET 后
-- 说明：本脚本仅先收口 partner_accounts，不影响 admin 其他业务表

alter table if exists public.partner_accounts enable row level security;

-- Service Role 全权限（后端 API 使用）
drop policy if exists partner_accounts_service_role_all on public.partner_accounts;
create policy partner_accounts_service_role_all
on public.partner_accounts
for all
using (auth.role() = 'service_role')
with check (auth.role() = 'service_role');

-- 商户仅可读取自己的账号行
drop policy if exists partner_accounts_self_select on public.partner_accounts;
create policy partner_accounts_self_select
on public.partner_accounts
for select
using (
  nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'partner_account_id', '')::uuid = id
);

-- 商户仅可更新自己的账号行（当前仅用于解绑脏数据 bar_id）
drop policy if exists partner_accounts_self_update on public.partner_accounts;
create policy partner_accounts_self_update
on public.partner_accounts
for update
using (
  nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'partner_account_id', '')::uuid = id
)
with check (
  nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'partner_account_id', '')::uuid = id
);
