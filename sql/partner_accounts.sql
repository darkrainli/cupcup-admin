-- 管理员开通商户账号（可先不绑定门店）
create extension if not exists pgcrypto;

create table if not exists public.partner_accounts (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  bar_id uuid references public.bars(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.partner_accounts
  add column if not exists password_hash text;

create index if not exists idx_partner_accounts_bar_id on public.partner_accounts(bar_id);

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
