-- Athletic Lab sync schema. One table of records keyed by family. The family id is the sha256 of a
-- secret both phones hold; every request carries the secret in the x-family-key header and the
-- row-level policy only lets a request see rows whose family_id matches the hash of that header.
-- The server never stores the secret, only its hash.
create extension if not exists pgcrypto;

create table if not exists public.records (
  family_id text not null,
  tbl text not null,
  id text not null,
  stamp text not null,
  data jsonb,
  deleted boolean not null default false,
  device text,
  server_ts timestamptz not null default now(),
  primary key (family_id, tbl, id)
);
create index if not exists records_family_ts on public.records (family_id, server_ts);

create or replace function public.family_key_id() returns text
language sql stable as $$
  select encode(digest(coalesce(current_setting('request.headers', true)::json->>'x-family-key', ''), 'sha256'), 'hex')
$$;

alter table public.records enable row level security;
drop policy if exists "family rows" on public.records;
create policy "family rows" on public.records
  for all to anon
  using (family_id = public.family_key_id() and length(coalesce(current_setting('request.headers', true)::json->>'x-family-key', '')) >= 16)
  with check (family_id = public.family_key_id() and length(coalesce(current_setting('request.headers', true)::json->>'x-family-key', '')) >= 16);

-- An older copy never overwrites a newer one; the server stamps every accepted write.
create or replace function public.records_guard() returns trigger
language plpgsql as $$
begin
  if tg_op = 'UPDATE' and new.stamp < old.stamp then
    return old;
  end if;
  new.server_ts := now();
  return new;
end $$;
drop trigger if exists records_guard on public.records;
create trigger records_guard before insert or update on public.records
  for each row execute function public.records_guard();

grant select, insert, update on public.records to anon;
