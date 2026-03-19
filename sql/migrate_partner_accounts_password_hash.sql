-- 将 partner_accounts 从明文密码迁移到 password_hash
-- 执行后：登录和重置密码全部走 password_hash

create extension if not exists pgcrypto;

alter table public.partner_accounts
  add column if not exists password_hash text;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'partner_accounts'
      and column_name = 'password'
  ) then
    execute $sql$
      update public.partner_accounts
      set password_hash = encode(digest(password, 'sha256'), 'hex')
      where coalesce(password_hash, '') = ''
        and coalesce(password, '') <> ''
    $sql$;
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from public.partner_accounts
    where coalesce(password_hash, '') = ''
  ) then
    raise exception 'partner_accounts 仍存在空 password_hash，请先修复后再继续';
  end if;
end $$;

alter table public.partner_accounts
  alter column password_hash set not null;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'partner_accounts'
      and column_name = 'password'
  ) then
    execute 'alter table public.partner_accounts alter column password drop not null';
    execute 'update public.partner_accounts set password = null where password is not null';
  end if;
end $$;

-- 可选：确认线上完全稳定后再执行（彻底删除明文字段）
-- alter table public.partner_accounts drop column if exists password;
