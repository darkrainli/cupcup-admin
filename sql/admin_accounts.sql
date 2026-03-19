-- 管理员账号表（替代前端硬编码账号密码）
-- 初始默认账号：cupadmin / cup9898（上线后请立即改密）

create extension if not exists pgcrypto;

create table if not exists public.admin_accounts (
  id uuid primary key default gen_random_uuid(),
  login_id text not null unique,
  display_name text not null default 'CupCup Admin',
  password_hash text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_admin_accounts_login_id on public.admin_accounts(login_id);

create or replace function public.set_admin_accounts_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_admin_accounts_updated_at on public.admin_accounts;
create trigger trg_admin_accounts_updated_at
before update on public.admin_accounts
for each row execute function public.set_admin_accounts_updated_at();

insert into public.admin_accounts (login_id, display_name, password_hash, is_active)
values ('cupadmin', 'CupCup Admin', '7bc3de09e724dd706f31443ce6314334a5cc5ab2d203bbbb28ea8158a7d273bc', true)
on conflict (login_id) do nothing;

