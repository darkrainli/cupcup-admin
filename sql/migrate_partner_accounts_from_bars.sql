-- 将 bars 表里的历史账号迁移到 partner_accounts（一次性执行）
-- 前提：先执行 sql/partner_accounts.sql

create extension if not exists pgcrypto;

insert into public.partner_accounts (email, password_hash, bar_id)
select
  lower(trim(owner_email)) as email,
  encode(digest(owner_password, 'sha256'), 'hex') as password_hash,
  id as bar_id
from public.bars
where owner_email is not null
  and trim(owner_email) <> ''
  and owner_password is not null
  and trim(owner_password) <> ''
on conflict (email) do update
set
  password_hash = excluded.password_hash,
  bar_id = excluded.bar_id,
  updated_at = now();
