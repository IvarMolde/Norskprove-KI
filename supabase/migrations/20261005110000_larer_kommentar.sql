-- ============================================================
-- Fase 8: lærer kommenterer nivået på muntlig opptak
-- ============================================================
-- Kommentaren er ikke KI-vurderingen. Eleven leser den selv.
-- Se beslutningen i ROADMAP.md.

create table public.larer_kommentar (
  bruker_svar_id uuid primary key references public.bruker_svar(id) on delete cascade,
  larer_id uuid references auth.users(id) on delete set null,
  niva text not null check (niva in ('Under A1', 'A1', 'A2', 'B1', 'B2')),
  kommentar text not null check (char_length(btrim(kommentar)) between 1 and 1000),
  oppdatert timestamptz not null default now()
);

alter table public.larer_kommentar enable row level security;

create or replace function public.antall_uten_larerkommentar()
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
  where s.svar_lyd_url like 'muntlig-opptak/%'
    and o.ferdighet = 'muntlig'
    and not exists (
      select 1
      from public.larer_kommentar k
      where k.bruker_svar_id = s.id
    );

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
      'ny', s.larer_sett is null,
      'har_kommentar', k.bruker_svar_id is not null
    ) as rad
    from public.bruker_svar s
    join auth.users u on u.id = s.bruker_id
    join public.oppgaver o on o.id = s.oppgave_id
    left join public.larer_kommentar k on k.bruker_svar_id = s.id
    where s.svar_lyd_url like 'muntlig-opptak/%'
      and o.ferdighet = 'muntlig'
      and nullif(btrim(u.email), '') is not null
      and nullif(btrim(o.innhold->>'tittel'), '') is not null
    order by (k.bruker_svar_id is null) desc,
             (s.larer_sett is null) desc,
             s.innsendt_dato desc
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
    'ny', s.larer_sett is null,
    'har_kommentar', k.bruker_svar_id is not null,
    'larer', case
      when k.bruker_svar_id is null then null
      else jsonb_build_object('niva', k.niva, 'kommentar', k.kommentar)
    end
  )
  into v_rad
  from public.bruker_svar s
  join auth.users u on u.id = s.bruker_id
  join public.oppgaver o on o.id = s.oppgave_id
  left join public.larer_kommentar k on k.bruker_svar_id = s.id
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

create or replace function public.lagre_larer_kommentar(
  p_svar_id uuid,
  p_niva text,
  p_kommentar text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tekst text := btrim(coalesce(p_kommentar, ''));
begin
  perform public.krev_larer();

  if p_niva is null or p_niva not in ('Under A1', 'A1', 'A2', 'B1', 'B2') then
    raise exception 'ugyldig_larerniva' using errcode = 'P0001';
  end if;

  if v_tekst = '' then
    raise exception 'kommentar_mangler' using errcode = 'P0001';
  end if;

  if char_length(v_tekst) > 1000 then
    raise exception 'ugyldig_svar' using errcode = 'P0001';
  end if;

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

  insert into public.larer_kommentar (bruker_svar_id, larer_id, niva, kommentar)
  values (p_svar_id, auth.uid(), p_niva, v_tekst)
  on conflict (bruker_svar_id) do update
  set larer_id = excluded.larer_id,
      niva = excluded.niva,
      kommentar = excluded.kommentar,
      oppdatert = now();

  update public.bruker_svar
  set larer_sett = now()
  where id = p_svar_id
    and larer_sett is null;

  return jsonb_build_object('niva', p_niva, 'kommentar', v_tekst);
end;
$$;

create or replace function public.hent_muntlig_okt(p_okt_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_okt public.okt_tilstand%rowtype;
  v_oppgave jsonb;
begin
  if v_uid is null then
    raise exception 'ikke_innlogget' using errcode = 'P0001';
  end if;

  if not exists (
    select 1
    from public.brukerprofil b
    join public.plan_rettigheter r
      on r.plan_id = b.abonnement_plan_id
    where b.id = v_uid
      and r.rettighet = 'muntlig_ki_vurdering'
  ) then
    raise exception 'mangler_muntlig' using errcode = 'P0001';
  end if;

  select * into v_okt
  from public.okt_tilstand
  where id = p_okt_id
    and bruker_id = v_uid
    and ferdighet = 'muntlig';

  if not found then
    raise exception 'okt_ikke_funnet' using errcode = 'P0001';
  end if;

  select jsonb_build_object(
    'id', o.id,
    'tittel', o.innhold->>'tittel',
    'tekst', o.innhold->>'tekst',
    'oppgavetype', o.innhold->>'oppgavetype',
    'nivagruppe', o.innhold->>'nivagruppe',
    'svar', svar.svar_tekst,
    'har_lyd', coalesce(svar.svar_lyd_url is not null, false),
    'larer', case
      when lk.bruker_svar_id is null then null
      else jsonb_build_object('niva', lk.niva, 'kommentar', lk.kommentar)
    end,
    'vurdering', case
      when v.id is null then null
      else jsonb_build_object(
        'samlet_niva', v.samlet_niva,
        'forbedringspunkter', to_jsonb(v.forbedringspunkter),
        'positivt_element', v.positivt_element,
        'tilbakemelding_til_elev', v.tilbakemelding_til_elev,
        'usikker_vurdering', v.usikker_vurdering,
        'usikker_pga_lyd', v.usikker_pga_lyd
      )
    end
  )
  into v_oppgave
  from public.okt_oppgaver oo
  join public.oppgaver o on o.id = oo.oppgave_id
  left join lateral (
    select s.id, s.svar_tekst, s.svar_lyd_url
    from public.bruker_svar s
    where s.okt_id = v_okt.id
      and s.oppgave_id = o.id
      and s.bruker_id = v_uid
    order by s.innsendt_dato desc
    limit 1
  ) svar on true
  left join public.muntlig_vurdering v on v.bruker_svar_id = svar.id
  left join public.larer_kommentar lk on lk.bruker_svar_id = svar.id
  where oo.okt_id = v_okt.id
    and o.ferdighet = 'muntlig'
    and o.type = 'muntlig_opptak'
  order by oo.rekkefolge
  limit 1;

  if v_oppgave is null then
    raise exception 'oppgave_ikke_funnet' using errcode = 'P0001';
  end if;

  return jsonb_build_object(
    'id', v_okt.id,
    'status', v_okt.status,
    'oppgave', v_oppgave
  );
end;
$$;

revoke all on function public.antall_uten_larerkommentar() from public;
revoke all on function public.antall_uten_larerkommentar() from anon;
grant execute on function public.antall_uten_larerkommentar() to authenticated;

revoke all on function public.lagre_larer_kommentar(uuid, text, text) from public;
revoke all on function public.lagre_larer_kommentar(uuid, text, text) from anon;
grant execute on function public.lagre_larer_kommentar(uuid, text, text) to authenticated;
