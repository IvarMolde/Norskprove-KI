-- Sikker tilgang og lagring for admin-panelet.
-- Første administrator opprettes manuelt med service role:
-- insert into public.admin_brukere (bruker_id) values ('<auth.users.id>');

create table public.admin_brukere (
  bruker_id uuid primary key references auth.users(id) on delete cascade,
  rolle text not null default 'redaktor' check (rolle in ('redaktor', 'admin')),
  aktiv boolean not null default true,
  opprettet_dato timestamptz not null default now()
);

alter table public.admin_brukere enable row level security;

create policy "Administrator ser egen rolle"
  on public.admin_brukere
  for select
  to authenticated
  using ((select auth.uid()) = bruker_id);

create or replace function public.er_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_brukere
    where bruker_id = (select auth.uid())
      and aktiv = true
  );
$$;

revoke all on function public.er_admin() from public;
grant execute on function public.er_admin() to authenticated;

create policy "Administrator administrerer oppgaver"
  on public.oppgaver
  for all
  to authenticated
  using ((select public.er_admin()))
  with check ((select public.er_admin()));

create policy "Administrator administrerer bilder"
  on public.bilder
  for all
  to authenticated
  using ((select public.er_admin()))
  with check ((select public.er_admin()));

create table public.lydfiler (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null unique,
  navn text not null,
  transkripsjon text,
  kilde text not null check (kilde in ('opptak', 'opplastet', 'tts')),
  mime_type text not null check (mime_type in (
    'audio/webm', 'audio/ogg', 'audio/mpeg', 'audio/mp4', 'audio/wav'
  )),
  opprettet_av uuid not null references auth.users(id),
  opprettet_dato timestamptz not null default now()
);

alter table public.lydfiler enable row level security;

create policy "Administrator administrerer lydfiler"
  on public.lydfiler
  for all
  to authenticated
  using ((select public.er_admin()))
  with check ((select public.er_admin()));

alter table public.oppgaver
  add column lydfil_id uuid references public.lydfiler(id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'admin-bilder',
    'admin-bilder',
    false,
    10485760,
    array['image/jpeg', 'image/png', 'image/webp']
  ),
  (
    'admin-lyd',
    'admin-lyd',
    false,
    26214400,
    array['audio/webm', 'audio/ogg', 'audio/mpeg', 'audio/mp4', 'audio/wav']
  )
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Administrator leser adminfiler"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id in ('admin-bilder', 'admin-lyd')
    and (select public.er_admin())
  );

create policy "Administrator laster opp adminfiler"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id in ('admin-bilder', 'admin-lyd')
    and (select public.er_admin())
  );

create policy "Administrator oppdaterer adminfiler"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id in ('admin-bilder', 'admin-lyd')
    and (select public.er_admin())
  )
  with check (
    bucket_id in ('admin-bilder', 'admin-lyd')
    and (select public.er_admin())
  );

create policy "Administrator sletter adminfiler"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id in ('admin-bilder', 'admin-lyd')
    and (select public.er_admin())
  );
