create table if not exists public.paper_ai_settings (
 owner_id uuid primary key references auth.users(id) on delete cascade,
 encrypted_key text not null default '',
 options jsonb not null default '{}'::jsonb,
 locked_until timestamptz not null default '1970-01-01'
);
alter table public.paper_ai_settings enable row level security;
revoke all on public.paper_ai_settings from anon, authenticated;
grant all on public.paper_ai_settings to service_role;
