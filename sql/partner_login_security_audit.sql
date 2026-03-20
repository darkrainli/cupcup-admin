-- 商户登录安全增强：失败限流/锁定 + 登录审计日志
-- 策略：连续失败 5 次锁定 15 分钟（锁定逻辑由 api/partner-login 执行）

create extension if not exists pgcrypto;

alter table if exists public.partner_accounts
  add column if not exists is_active boolean not null default true,
  add column if not exists failed_attempts integer not null default 0,
  add column if not exists lock_until timestamptz,
  add column if not exists last_login_at timestamptz,
  add column if not exists last_login_ip text,
  add column if not exists last_login_user_agent text;

create table if not exists public.partner_login_audit_logs (
  id bigserial primary key,
  partner_account_id uuid references public.partner_accounts(id) on delete set null,
  email text not null,
  status text not null check (status in ('success', 'failure')),
  reason text,
  failed_count integer,
  locked_until timestamptz,
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists idx_partner_login_audit_logs_created_at
  on public.partner_login_audit_logs(created_at desc);

create index if not exists idx_partner_login_audit_logs_account_created_at
  on public.partner_login_audit_logs(partner_account_id, created_at desc);

create index if not exists idx_partner_login_audit_logs_email_created_at
  on public.partner_login_audit_logs(email, created_at desc);
