-- 管理员开通商户账号（可先不绑定门店）
create extension if not exists pgcrypto;

create table if not exists public.partner_accounts (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  bar_id uuid references public.bars(id) on delete set null,
  is_active boolean not null default true,
  failed_attempts integer not null default 0,
  lock_until timestamptz,
  last_login_at timestamptz,
  last_login_ip text,
  last_login_user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.partner_accounts
  add column if not exists password_hash text,
  add column if not exists is_active boolean not null default true,
  add column if not exists failed_attempts integer not null default 0,
  add column if not exists lock_until timestamptz,
  add column if not exists last_login_at timestamptz,
  add column if not exists last_login_ip text,
  add column if not exists last_login_user_agent text;

create index if not exists idx_partner_accounts_bar_id on public.partner_accounts(bar_id);
create index if not exists idx_partner_accounts_email on public.partner_accounts(email);

create or replace function public.set_partner_accounts_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_partner_accounts_updated_at on public.partner_accounts;
create trigger trg_partner_accounts_updated_at
before update on public.partner_accounts
for each row execute function public.set_partner_accounts_updated_at();

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
