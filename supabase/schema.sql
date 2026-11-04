-- Run this once in Supabase: SQL Editor > New query > paste > Run.
-- All access goes through the Next.js server with the service role key,
-- so RLS is enabled with no policies: the public anon key can read nothing.

create table if not exists public.settings (
  user_id    text primary key,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.recipes (
  user_id     text not null,
  id          text not null,
  title       text not null,
  meal_type   text not null,
  cuisine     text not null default '',
  servings    text not null default '',
  ingredients jsonb not null default '[]'::jsonb,
  steps       jsonb not null default '[]'::jsonb,
  tip         text not null default '',
  source      text not null default '',
  created_at  timestamptz not null default now(),
  primary key (user_id, id)
);

create table if not exists public.plan_slots (
  user_id   text not null,
  date      date not null,
  meal      text not null,
  recipe_id text not null,
  primary key (user_id, date, meal),
  foreign key (user_id, recipe_id) references public.recipes (user_id, id) on delete cascade
);
create index if not exists plan_slots_user_date on public.plan_slots (user_id, date);

create table if not exists public.shopping_checks (
  user_id    text not null,
  key        text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, key)
);

alter table public.settings        enable row level security;
alter table public.recipes         enable row level security;
alter table public.plan_slots      enable row level security;
alter table public.shopping_checks enable row level security;
