-- ============================================================
-- Fase 8: lærer hører muntlige innleveringer
-- ============================================================
-- Nye opptak er umerket til en lærer åpner dem.
-- Eleven kan ikke fjerne merket eller lydadressen.
-- Se beslutningen i ROADMAP.md.

alter table public.brukerprofil
  drop constraint brukerprofil_rolle_check;

alter table public.brukerprofil
  add constraint brukerprofil_rolle_check
  check (rolle in ('elev', 'redaktor', 'larer'));

alter table public.bruker_svar
  add column larer_sett timestamptz;

create or replace function public.er_larer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.brukerprofil
    where id = auth.uid()
      and rolle = 'larer'
  );
$$;

create or replace function public.krev_larer()
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'ikke_innlogget' using errcode = 'P0001';
  end if;

  if not public.er_larer() then
    raise exception 'ikke_larer' using errcode = 'P0001';
  end if;
end;
$$;

create or replace function public.beskytt_innlevering()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op <> 'UPDATE' or auth.uid() is null then
    return new;
  end if;

  if new.svar_lyd_url is distinct from old.svar_lyd_url then
    raise exception 'ugyldig_svar' using errcode = 'P0001';
  end if;

  if new.larer_sett is distinct from old.larer_sett
     and not public.er_larer() then
    raise exception 'ikke_larer' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists bruker_svar_beskytt_innlevering on public.bruker_svar;

create trigger bruker_svar_beskytt_innlevering
  before update on public.bruker_svar
  for each row execute function public.beskytt_innlevering();

create or replace function public.antall_nye_muntlige()
returns int
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_antall int;
begin
  perform public.krev_larer();

  select count(*)::int into v_antall
  from public.bruker_svar s
  join public.oppgaver o on o.id = s.oppgave_id
  where s.larer_sett is null
    and s.svar_lyd_url like 'muntlig-opptak/%'
    and o.ferdighet = 'muntlig';

  return v_antall;
end;
$$;

create or replace function public.hent_muntlige_innleveringer()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_rader jsonb;
begin
  perform public.krev_larer();

  select coalesce(jsonb_agg(t.rad), '[]'::jsonb)
    into v_rader
  from (
    select jsonb_build_object(
      'id', s.id,
      'epost', u.email,
      'tittel', o.innhold->>'tittel',
      'innsendt', s.innsendt_dato,
      'ny', s.larer_sett is null
    ) as rad
    from public.bruker_svar s
    join auth.users u on u.id = s.bruker_id
    join public.oppgaver o on o.id = s.oppgave_id
    where s.svar_lyd_url like 'muntlig-opptak/%'
      and o.ferdighet = 'muntlig'
      and nullif(btrim(u.email), '') is not null
      and nullif(btrim(o.innhold->>'tittel'), '') is not null
    order by (s.larer_sett is null) desc, s.innsendt_dato desc
    limit 50
  ) t;

  return v_rader;
end;
$$;

create or replace function public.hent_muntlig_innlevering(p_svar_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_rad jsonb;
begin
  perform public.krev_larer();

  select jsonb_build_object(
    'id', s.id,
    'epost', u.email,
    'tittel', o.innhold->>'tittel',
    'oppgavetekst', o.innhold->>'tekst',
    'svar', s.svar_tekst,
    'innsendt', s.innsendt_dato,
    'ny', s.larer_sett is null
  )
  into v_rad
  from public.bruker_svar s
  join auth.users u on u.id = s.bruker_id
  join public.oppgaver o on o.id = s.oppgave_id
  where s.id = p_svar_id
    and s.svar_lyd_url like 'muntlig-opptak/%'
    and o.ferdighet = 'muntlig'
    and nullif(btrim(u.email), '') is not null;

  if v_rad is null then
    raise exception 'innlevering_mangler' using errcode = 'P0001';
  end if;

  return v_rad;
end;
$$;

create or replace function public.marker_muntlig_hort(p_svar_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.krev_larer();

  update public.bruker_svar s
  set larer_sett = now()
  from public.oppgaver o
  where s.id = p_svar_id
    and o.id = s.oppgave_id
    and o.ferdighet = 'muntlig'
    and s.svar_lyd_url like 'muntlig-opptak/%'
    and s.larer_sett is null;

  if not exists (
    select 1
    from public.bruker_svar s
    join public.oppgaver o on o.id = s.oppgave_id
    where s.id = p_svar_id
      and o.ferdighet = 'muntlig'
      and s.svar_lyd_url like 'muntlig-opptak/%'
  ) then
    raise exception 'innlevering_mangler' using errcode = 'P0001';
  end if;
end;
$$;

create or replace function public.hent_muntlig_lydadresse(p_svar_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_adresse text;
begin
  perform public.krev_larer();

  select s.svar_lyd_url into v_adresse
  from public.bruker_svar s
  join public.oppgaver o on o.id = s.oppgave_id
  where s.id = p_svar_id
    and o.ferdighet = 'muntlig'
    and s.svar_lyd_url ~ (
      '^muntlig-opptak/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/'
      || '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(webm|wav|mp3|ogg)$'
    );

  if v_adresse is null then
    raise exception 'innlevering_mangler' using errcode = 'P0001';
  end if;

  return v_adresse;
end;
$$;

revoke all on function public.er_larer() from public;
revoke all on function public.er_larer() from anon;
grant execute on function public.er_larer() to authenticated;

revoke all on function public.krev_larer() from public;
revoke all on function public.krev_larer() from anon;
revoke all on function public.krev_larer() from authenticated;

revoke all on function public.beskytt_innlevering() from public;
revoke all on function public.beskytt_innlevering() from anon;
revoke all on function public.beskytt_innlevering() from authenticated;

revoke all on function public.antall_nye_muntlige() from public;
revoke all on function public.antall_nye_muntlige() from anon;
grant execute on function public.antall_nye_muntlige() to authenticated;

revoke all on function public.hent_muntlige_innleveringer() from public;
revoke all on function public.hent_muntlige_innleveringer() from anon;
grant execute on function public.hent_muntlige_innleveringer() to authenticated;

revoke all on function public.hent_muntlig_innlevering(uuid) from public;
revoke all on function public.hent_muntlig_innlevering(uuid) from anon;
grant execute on function public.hent_muntlig_innlevering(uuid) to authenticated;

revoke all on function public.marker_muntlig_hort(uuid) from public;
revoke all on function public.marker_muntlig_hort(uuid) from anon;
grant execute on function public.marker_muntlig_hort(uuid) to authenticated;

revoke all on function public.hent_muntlig_lydadresse(uuid) from public;
revoke all on function public.hent_muntlig_lydadresse(uuid) from anon;
grant execute on function public.hent_muntlig_lydadresse(uuid) to authenticated;
