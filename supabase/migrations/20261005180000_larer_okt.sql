-- ============================================================
-- Fase 8: læreren ser én innlevering per muntlig økt
-- ============================================================
-- Begge opptakene ligger på samme side. Ny og manglende kommentar
-- gjelder økten. Se beslutningen i ROADMAP.md.

create or replace function public.muntlig_innlevering_okt(p_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select funnet.okt_id
  from (
    select s.okt_id
    from public.bruker_svar s
    join public.oppgaver o on o.id = s.oppgave_id
    where s.id = p_id
      and s.okt_id is not null
      and s.svar_lyd_url like 'muntlig-opptak/%'
      and o.ferdighet = 'muntlig'
    union all
    select ot.id
    from public.okt_tilstand ot
    where ot.id = p_id
      and ot.ferdighet = 'muntlig'
      and exists (
        select 1
        from public.bruker_svar s
        join public.oppgaver o on o.id = s.oppgave_id
        where s.okt_id = ot.id
          and s.svar_lyd_url like 'muntlig-opptak/%'
          and o.ferdighet = 'muntlig'
      )
  ) funnet
  limit 1;
$$;

revoke all on function public.muntlig_innlevering_okt(uuid) from public;
revoke all on function public.muntlig_innlevering_okt(uuid) from anon;
revoke all on function public.muntlig_innlevering_okt(uuid) from authenticated;

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
  from (
    select s.okt_id
    from public.bruker_svar s
    join public.oppgaver o on o.id = s.oppgave_id
    where s.larer_sett is null
      and s.svar_lyd_url like 'muntlig-opptak/%'
      and o.ferdighet = 'muntlig'
      and s.okt_id is not null
    group by s.okt_id
  ) okt;

  return v_antall;
end;
$$;

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
  from (
    select s.okt_id
    from public.bruker_svar s
    join public.oppgaver o on o.id = s.oppgave_id
    left join public.larer_kommentar k on k.bruker_svar_id = s.id
    where s.svar_lyd_url like 'muntlig-opptak/%'
      and o.ferdighet = 'muntlig'
      and s.okt_id is not null
    group by s.okt_id
    having bool_and(k.bruker_svar_id is not null) = false
  ) okt;

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

  select coalesce(
    jsonb_agg(
      t.rad
      order by t.ny desc, t.har_kommentar asc, t.innsendt desc
    ),
    '[]'::jsonb
  )
  into v_rader
  from (
    select
      jsonb_build_object(
        'id', ot.id,
        'epost', min(u.email),
        'tittel', string_agg(o.innhold->>'tittel', '. ' order by oo.rekkefolge, s.innsendt_dato),
        'antall', count(s.id),
        'innsendt', max(s.innsendt_dato),
        'ny', bool_or(s.larer_sett is null),
        'har_kommentar', bool_and(k.bruker_svar_id is not null)
      ) as rad,
      bool_or(s.larer_sett is null) as ny,
      bool_and(k.bruker_svar_id is not null) as har_kommentar,
      max(s.innsendt_dato) as innsendt
    from public.okt_tilstand ot
    join public.bruker_svar s on s.okt_id = ot.id
    join public.oppgaver o on o.id = s.oppgave_id
    join auth.users u on u.id = s.bruker_id
    left join public.okt_oppgaver oo
      on oo.okt_id = ot.id
     and oo.oppgave_id = s.oppgave_id
    left join public.larer_kommentar k on k.bruker_svar_id = s.id
    where ot.ferdighet = 'muntlig'
      and s.svar_lyd_url like 'muntlig-opptak/%'
      and o.ferdighet = 'muntlig'
      and nullif(btrim(u.email), '') is not null
      and nullif(btrim(o.innhold->>'tittel'), '') is not null
    group by ot.id
    order by bool_or(s.larer_sett is null) desc,
             bool_and(k.bruker_svar_id is not null) asc,
             max(s.innsendt_dato) desc
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
  v_okt uuid;
  v_rad jsonb;
begin
  perform public.krev_larer();

  v_okt := public.muntlig_innlevering_okt(p_svar_id);
  if v_okt is null then
    raise exception 'innlevering_mangler' using errcode = 'P0001';
  end if;

  select jsonb_build_object(
    'id', v_okt,
    'epost', min(u.email),
    'tittel', string_agg(o.innhold->>'tittel', '. ' order by oo.rekkefolge, s.innsendt_dato),
    'innsendt', max(s.innsendt_dato),
    'ny', bool_or(s.larer_sett is null),
    'har_kommentar', bool_and(k.bruker_svar_id is not null),
    'deler', coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', s.id,
          'tittel', o.innhold->>'tittel',
          'oppgavetekst', o.innhold->>'tekst',
          'bilde', case
            when b.url is null then null
            else jsonb_build_object(
              'url', b.url,
              'beskrivelse', b.beskrivelse,
              'endelse', b.endelse
            )
          end,
          'svar', s.svar_tekst,
          'ny', s.larer_sett is null,
          'har_kommentar', k.bruker_svar_id is not null,
          'larer', case
            when k.bruker_svar_id is null then null
            else jsonb_build_object('niva', k.niva, 'kommentar', k.kommentar)
          end
        )
        order by oo.rekkefolge, s.innsendt_dato
      ),
      '[]'::jsonb
    )
  )
  into v_rad
  from public.bruker_svar s
  join public.oppgaver o on o.id = s.oppgave_id
  join auth.users u on u.id = s.bruker_id
  left join public.okt_oppgaver oo
    on oo.okt_id = s.okt_id
   and oo.oppgave_id = s.oppgave_id
  left join lateral public.godkjent_oppgavebilde(o.bilde_id) b on true
  left join public.larer_kommentar k on k.bruker_svar_id = s.id
  where s.okt_id = v_okt
    and s.svar_lyd_url like 'muntlig-opptak/%'
    and o.ferdighet = 'muntlig'
    and nullif(btrim(u.email), '') is not null
    and nullif(btrim(o.innhold->>'tittel'), '') is not null
    and nullif(btrim(o.innhold->>'tekst'), '') is not null;

  if v_rad is null or jsonb_array_length(v_rad->'deler') = 0 then
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
declare
  v_okt uuid;
begin
  perform public.krev_larer();

  v_okt := public.muntlig_innlevering_okt(p_svar_id);
  if v_okt is null then
    raise exception 'innlevering_mangler' using errcode = 'P0001';
  end if;

  update public.bruker_svar s
  set larer_sett = now()
  from public.oppgaver o
  where s.okt_id = v_okt
    and o.id = s.oppgave_id
    and o.ferdighet = 'muntlig'
    and s.svar_lyd_url like 'muntlig-opptak/%'
    and s.larer_sett is null;
end;
$$;

notify pgrst, 'reload schema';
