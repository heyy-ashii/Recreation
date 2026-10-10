-- Posts: every account holder can share a short text thought. Safe to re-run.

create table if not exists app_posts (
  id         uuid primary key default gen_random_uuid(),
  author_id  uuid not null references app_users (id) on delete cascade,
  body       text not null,
  -- ids of the users who liked the post; kept as an array so the count and the
  -- "did I like this" check need no extra join.
  likes      uuid[] not null default '{}',
  hidden     boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists app_posts_created_at_idx on app_posts (created_at desc);
create index if not exists app_posts_author_idx on app_posts (author_id, created_at desc);

do $$
begin
  execute 'drop trigger if exists app_posts_touch on app_posts';
  execute 'create trigger app_posts_touch before update on app_posts for each row execute function app_touch_updated_at()';
end $$;

-- Same lockdown as the other tables: RLS on with no policies, so the
-- publishable key cannot read anything; the backend bypasses it.
alter table app_posts enable row level security;
