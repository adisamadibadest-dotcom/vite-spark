-- Run this in your Supabase SQL editor (Database → SQL Editor → New query)
-- Creates the payment_submissions table for manual M-Pesa payment verification

create table if not exists public.payment_submissions (
  id              uuid         primary key default gen_random_uuid(),
  email           text         not null,
  package         text         not null,
  price           numeric(10,2) not null,
  duration_days   integer      not null,
  transaction_code text        not null,
  status          text         not null default 'pending'
                               check (status in ('pending', 'approved', 'rejected')),
  created_at      timestamptz  not null default now(),
  reviewed_at     timestamptz,
  reviewed_by     text
);

-- Enable Row Level Security
alter table public.payment_submissions enable row level security;

-- Any authenticated user can submit a payment
create policy "users_can_submit"
  on public.payment_submissions
  for insert
  to authenticated
  with check (true);

-- Users see their own submissions; admin sees all
create policy "users_see_own_admin_sees_all"
  on public.payment_submissions
  for select
  to authenticated
  using (
    lower(email) = lower(auth.jwt() ->> 'email')
    or exists (
      select 1 from public.user_roles
      where user_id = auth.uid() and role = 'admin'
    )
    or lower(auth.jwt() ->> 'email') = 'apexgoldaiteam1@gmail.com'
  );

-- Only admin can update (approve / reject)
create policy "admin_can_update"
  on public.payment_submissions
  for update
  to authenticated
  using (
    exists (
      select 1 from public.user_roles
      where user_id = auth.uid() and role = 'admin'
    )
    or lower(auth.jwt() ->> 'email') = 'apexgoldaiteam1@gmail.com'
  );
