-- DHGRAM application schema for Supabase / Postgres.
-- Tables are prefixed `app_` so they never collide with Supabase's own
-- `auth`, `storage` and `realtime` schemas.
--
-- Run this in the Supabase dashboard: SQL Editor > New query > paste > Run.
-- It is idempotent; re-running is safe.

create extension if not exists pgcrypto;

-- Keeps updated_at honest even for rows touched by hand in the dashboard.
create or replace function app_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists app_users (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null,
  username              text not null unique,
  email                 text unique,
  password              text not null,
  role                  text not null default 'user' check (role in ('user', 'admin')),
  status                text not null default 'active' check (status in ('active', 'disabled')),
  email_verified        boolean not null default false,
  password_changed_at   timestamptz,
  last_login_at         timestamptz,
  failed_login_attempts integer not null default 0,
  lock_until            timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create table if not exists app_otps (
  id         uuid primary key default gen_random_uuid(),
  email      text not null,
  purpose    text not null check (purpose in ('signup', 'reset')),
  code_hash  text not null,
  attempts   integer not null default 0,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (email, purpose)
);

create table if not exists app_conversations (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null unique references app_users (id) on delete cascade,
  status           text not null default 'open' check (status in ('open', 'closed')),
  last_message     text not null default '',
  last_message_at  timestamptz not null default now(),
  unread_for_admin integer not null default 0,
  unread_for_user  integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table if not exists app_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references app_conversations (id) on delete cascade,
  sender_id       uuid not null references app_users (id) on delete cascade,
  sender_role     text not null check (sender_role in ('user', 'admin')),
  body            text not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists app_conversations_last_message_at_idx on app_conversations (last_message_at desc);
create index if not exists app_messages_conversation_created_idx on app_messages (conversation_id, created_at);
create index if not exists app_otps_expires_at_idx on app_otps (expires_at);

do $$
declare t text;
begin
  foreach t in array array['app_users', 'app_otps', 'app_conversations', 'app_messages']
  loop
    execute format('drop trigger if exists %I_touch on %I', t, t);
    execute format(
      'create trigger %I_touch before update on %I for each row execute function app_touch_updated_at()',
      t, t
    );
  end loop;
end $$;

-- Lock the tables down. The backend reaches them either through the direct
-- Postgres connection or the secret (service_role) key, both of which bypass
-- RLS. With RLS on and no policies, the publishable key can read nothing, so
-- password hashes and OTP codes are not exposed to the browser.
alter table app_users         enable row level security;
alter table app_otps          enable row level security;
alter table app_conversations enable row level security;
alter table app_messages      enable row level security;
