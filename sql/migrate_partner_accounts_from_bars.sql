-- 将 bars 表里的历史账号迁移到 partner_accounts（一次性执行）
-- 前提：先执行 sql/partner_accounts.sql

insert into public.partner_accounts (email, password, bar_id)
select
  lower(trim(owner_email)) as email,
  owner_password as password,
  id as bar_id
from public.bars
where owner_email is not null
  and trim(owner_email) <> ''
  and owner_password is not null
  and trim(owner_password) <> ''
on conflict (email) do update
set
  password = excluded.password,
  bar_id = excluded.bar_id,
  updated_at = now();
