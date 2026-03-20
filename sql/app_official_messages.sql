-- App 官方消息（公告）与用户消息中心表
-- 适配 iOS 消息中心读取字段：
-- user_messages: id,user_id,type,event,title,body,cta_text,cta_route,cta_action,cta_payload,announcement_id,is_read,created_at
-- app_announcements: id,title,summary,content,cover_image_url,status,published_at,created_at

create table if not exists public.app_announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  summary text,
  content text not null,
  cover_image_url text,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  published_at timestamptz,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_app_announcements_status_created_at
  on public.app_announcements(status, created_at desc);

create table if not exists public.user_messages (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  type text not null check (type in ('activity', 'checkin', 'system')),
  event text not null,
  title text not null,
  body text not null,
  cta_text text,
  cta_route text,
  cta_action text,
  cta_payload jsonb,
  announcement_id uuid references public.app_announcements(id) on delete set null,
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_messages_user_created_at
  on public.user_messages(user_id, created_at desc);

create index if not exists idx_user_messages_user_unread
  on public.user_messages(user_id, is_read);

create index if not exists idx_user_messages_type_created_at
  on public.user_messages(type, created_at desc);

create or replace function public.set_updated_at_column()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_app_announcements_updated_at on public.app_announcements;
create trigger trg_app_announcements_updated_at
before update on public.app_announcements
for each row execute function public.set_updated_at_column();

drop trigger if exists trg_user_messages_updated_at on public.user_messages;
create trigger trg_user_messages_updated_at
before update on public.user_messages
for each row execute function public.set_updated_at_column();
