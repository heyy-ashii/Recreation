-- Student-to-student direct messages. Safe to re-run.
--
-- One row per pair of students. The two participants are stored in a fixed
-- order (user_a < user_b) so a lookup is a single equality on the pair and the
-- unique index stops a duplicate thread for the same two people.

create table if not exists app_peer_conversations (
  id              uuid primary key default gen_random_uuid(),
  user_a          uuid not null references app_users (id) on delete cascade,
  user_b          uuid not null references app_users (id) on delete cascade,
  last_message    text not null default '',
  last_message_at timestamptz not null default now(),
  -- unread_* is relative to the participant, not to a role.
  unread_for_a    integer not null default 0,
  unread_for_b    integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (user_a, user_b)
);

create table if not exists app_peer_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references app_peer_conversations (id) on delete cascade,
  sender_id       uuid not null references app_users (id) on delete cascade,
  body            text not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists app_peer_conversations_a_idx on app_peer_conversations (user_a, last_message_at desc);
create index if not exists app_peer_conversations_b_idx on app_peer_conversations (user_b, last_message_at desc);
create index if not exists app_peer_messages_conversation_idx on app_peer_messages (conversation_id, created_at);

do $$
begin
  execute 'drop trigger if exists app_peer_conversations_touch on app_peer_conversations';
  execute 'create trigger app_peer_conversations_touch before update on app_peer_conversations for each row execute function app_touch_updated_at()';
  execute 'drop trigger if exists app_peer_messages_touch on app_peer_messages';
  execute 'create trigger app_peer_messages_touch before update on app_peer_messages for each row execute function app_touch_updated_at()';
end $$;

-- Same lockdown as the other tables: RLS on with no policies, so the
-- publishable key cannot read anything; the backend bypasses it.
alter table app_peer_conversations enable row level security;
alter table app_peer_messages      enable row level security;
