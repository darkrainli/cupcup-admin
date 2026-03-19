-- 安全下线 bars.owner_email / bars.owner_password
-- 先备份，再删列（可回滚）

begin;

-- 1) 备份旧字段数据（仅备份有值记录）
create table if not exists public.bars_owner_legacy_backup as
select
  id as bar_id,
  owner_email,
  owner_password,
  now() as backed_up_at
from public.bars
where coalesce(trim(owner_email), '') <> ''
   or coalesce(trim(owner_password), '') <> '';

-- 2) 删除旧字段（如果已删过，不报错）
alter table public.bars
  drop column if exists owner_email,
  drop column if exists owner_password;

commit;

-- 回滚参考（需要时手动执行）:
-- alter table public.bars add column owner_email varchar;
-- alter table public.bars add column owner_password varchar;
-- update public.bars b
-- set owner_email = bk.owner_email,
--     owner_password = bk.owner_password
-- from public.bars_owner_legacy_backup bk
-- where b.id = bk.bar_id;
