-- Enable UUID extension
create extension if not exists "pgcrypto";

-- Enum
do $$ begin
  create type app_role as enum ('admin', 'user');
exception when duplicate_object then null;
end $$;

-- profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);
drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);

-- trades
create table if not exists public.trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  bias text not null,
  confidence numeric not null default 0,
  summary text,
  note text,
  image_data_url text,
  setup jsonb,
  annotation jsonb,
  created_at timestamptz not null default now()
);
alter table public.trades enable row level security;
drop policy if exists "Users can manage own trades" on public.trades;
create policy "Users can manage own trades" on public.trades for all using (auth.uid() = user_id);

-- alerts
create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null default 'XAUUSD',
  direction text not null,
  price numeric not null,
  note text,
  status text not null default 'active',
  triggered_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.alerts enable row level security;
drop policy if exists "Users can manage own alerts" on public.alerts;
create policy "Users can manage own alerts" on public.alerts for all using (auth.uid() = user_id);

-- user_roles
create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role app_role not null default 'user',
  created_at timestamptz not null default now()
);
alter table public.user_roles enable row level security;
drop policy if exists "Users can view own roles" on public.user_roles;
create policy "Users can view own roles" on public.user_roles for select using (auth.uid() = user_id);

-- subscriptions
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan text not null,
  status text not null default 'active',
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.subscriptions enable row level security;
drop policy if exists "Users can view own subscriptions" on public.subscriptions;
create policy "Users can view own subscriptions" on public.subscriptions for select using (auth.uid() = user_id);

-- watchlist
create table if not exists public.watchlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null,
  note text,
  created_at timestamptz not null default now()
);
alter table public.watchlist enable row level security;
drop policy if exists "Users can manage own watchlist" on public.watchlist;
create policy "Users can manage own watchlist" on public.watchlist for all using (auth.uid() = user_id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  insert into public.user_roles (user_id, role)
  values (new.id, 'user')
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
