-- 数据库收口：partner_accounts + merchant_profile_change_requests 索引硬化

-- 1) partner_accounts.email 唯一索引（规避历史环境未建约束）
do $$
begin
  if not exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'partner_accounts'
      and indexdef ilike 'create unique index%(%email%)'
  ) then
    execute 'create unique index idx_partner_accounts_email_unique on public.partner_accounts (email)';
  end if;
end $$;

-- 2) 商户资料审核单常用筛选索引
create index if not exists idx_mpr_request_type
on public.merchant_profile_change_requests (request_type);

create index if not exists idx_mpr_status_created_at
on public.merchant_profile_change_requests (status, created_at desc);
