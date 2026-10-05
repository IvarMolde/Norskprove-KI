-- ============================================================
-- Fase 8: muntlig fase 1 har to oppgaver i samme økt
-- ============================================================
-- Først fortelle, uten bilde. Deretter beskrive et bilde.
-- Økten er ferdig når begge svarene er lagret.
-- Promptfilen endres ikke. Se ROADMAP.md.

create or replace function public.muntlig_oppgave_json(
  p_okt_id uuid,
  p_oppgave_id uuid,
  p_uid uuid
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', o.id,
    'tittel', o.innhold->>'tittel',
    'tekst', o.innhold->>'tekst',
    'oppgavetype', o.innhold->>'oppgavetype',
    'nivagruppe', o.innhold->>'nivagruppe',
    'bilde', case
      when b.url is null then null
      else jsonb_build_object(
        'url', b.url,
        'beskrivelse', b.beskrivelse,
        'endelse', b.endelse
      )
    end,
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
  from public.oppgaver o
  left join lateral public.godkjent_oppgavebilde(o.bilde_id) b on true
  left join lateral (
    select s.id, s.svar_tekst, s.svar_lyd_url
    from public.bruker_svar s
    where s.okt_id = p_okt_id
      and s.oppgave_id = o.id
      and s.bruker_id = p_uid
    order by s.innsendt_dato desc
    limit 1
  ) svar on true
  left join public.muntlig_vurdering v on v.bruker_svar_id = svar.id
  left join public.larer_kommentar lk on lk.bruker_svar_id = svar.id
  where o.id = p_oppgave_id;
$$;

revoke all on function public.muntlig_oppgave_json(uuid, uuid, uuid) from public;
revoke all on function public.muntlig_oppgave_json(uuid, uuid, uuid) from anon;
revoke all on function public.muntlig_oppgave_json(uuid, uuid, uuid) from authenticated;

create or replace function public.start_muntlig_okt()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_okt uuid;
  v_grense int;
  v_periode text;
  v_brukte bigint;
  v_fortelle uuid;
  v_bilde uuid;
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

  perform pg_advisory_xact_lock(hashtextextended('start_muntlig_okt:' || v_uid::text, 0));

  select id into v_okt
  from public.okt_tilstand
  where bruker_id = v_uid
    and ferdighet = 'muntlig'
    and status = 'pagaende'
  order by startet desc
  limit 1;

  if v_okt is not null then
    return v_okt;
  end if;

  select p.okter_grense, p.okter_periode
    into v_grense, v_periode
  from public.brukerprofil b
  join public.abonnement_plan p on p.id = b.abonnement_plan_id
  where b.id = v_uid;

  if v_grense is null or v_periode is null then
    raise exception 'mangler_profil' using errcode = 'P0001';
  end if;

  if v_periode = 'totalt' then
    select count(*) into v_brukte
    from public.okt_tilstand
    where bruker_id = v_uid
      and status = 'fullfort';
  elsif v_periode = 'maned' then
    select count(*) into v_brukte
    from public.okt_tilstand
    where bruker_id = v_uid
      and status = 'fullfort'
      and startet >= date_trunc('month', now());
  else
    raise exception 'mangler_profil' using errcode = 'P0001';
  end if;

  if v_brukte >= v_grense then
    raise exception 'okt_grense' using errcode = 'P0001';
  end if;

  select o.id into v_fortelle
  from public.oppgaver o
  where o.status = 'publisert'
    and o.ferdighet = 'muntlig'
    and o.type = 'muntlig_opptak'
    and o.innhold->>'oppgavetype' = 'individuell_fortelle'
    and o.bilde_id is null
    and o.innhold->>'nivagruppe' in ('A1-A2', 'A2-B1', 'B1-B2')
    and nullif(btrim(o.innhold->>'tittel'), '') is not null
    and nullif(btrim(o.innhold->>'tekst'), '') is not null
    and not exists (
      select 1
      from public.bruker_oppgave_historikk h
      where h.bruker_id = v_uid
        and h.oppgave_id = o.id
    )
  order by o.ganger_servert, o.opprettet_dato
  limit 1;

  select o.id into v_bilde
  from public.oppgaver o
  where o.status = 'publisert'
    and o.ferdighet = 'muntlig'
    and o.type = 'muntlig_opptak'
    and o.innhold->>'oppgavetype' = 'individuell_beskrive_bilde'
    and o.innhold->>'nivagruppe' in ('A1-A2', 'A2-B1', 'B1-B2')
    and nullif(btrim(o.innhold->>'tittel'), '') is not null
    and nullif(btrim(o.innhold->>'tekst'), '') is not null
    and exists (select 1 from public.godkjent_oppgavebilde(o.bilde_id))
    and not exists (
      select 1
      from public.bruker_oppgave_historikk h
      where h.bruker_id = v_uid
        and h.oppgave_id = o.id
    )
  order by o.ganger_servert, o.opprettet_dato
  limit 1;

  if v_fortelle is null or v_bilde is null then
    raise exception 'ingen_oppgaver' using errcode = 'P0001';
  end if;

  insert into public.okt_tilstand (bruker_id, ferdighet)
  values (v_uid, 'muntlig')
  returning id into v_okt;

  insert into public.okt_oppgaver (okt_id, oppgave_id, rekkefolge)
  values
    (v_okt, v_fortelle, 1),
    (v_okt, v_bilde, 2);

  return v_okt;
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
  v_deler jsonb;
  v_nummer int;
  v_antall int;
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

  select count(*)::int into v_antall
  from public.okt_oppgaver
  where okt_id = v_okt.id;

  select coalesce(jsonb_agg(x.rad order by x.rekkefolge), '[]'::jsonb)
    into v_deler
  from (
    select
      oo.rekkefolge,
      public.muntlig_oppgave_json(v_okt.id, oo.oppgave_id, v_uid) as rad
    from public.okt_oppgaver oo
    join public.oppgaver o on o.id = oo.oppgave_id
    where oo.okt_id = v_okt.id
      and o.ferdighet = 'muntlig'
      and o.type = 'muntlig_opptak'
  ) x;

  select x.rekkefolge, x.rad
    into v_nummer, v_oppgave
  from (
    select
      oo.rekkefolge,
      public.muntlig_oppgave_json(v_okt.id, oo.oppgave_id, v_uid) as rad
    from public.okt_oppgaver oo
    join public.oppgaver o on o.id = oo.oppgave_id
    where oo.okt_id = v_okt.id
      and o.ferdighet = 'muntlig'
      and o.type = 'muntlig_opptak'
  ) x
  where x.rad->>'svar' is null
  order by x.rekkefolge
  limit 1;

  if v_oppgave is null then
    select x.rekkefolge, x.rad
      into v_nummer, v_oppgave
    from (
      select
        oo.rekkefolge,
        public.muntlig_oppgave_json(v_okt.id, oo.oppgave_id, v_uid) as rad
      from public.okt_oppgaver oo
      join public.oppgaver o on o.id = oo.oppgave_id
      where oo.okt_id = v_okt.id
        and o.ferdighet = 'muntlig'
        and o.type = 'muntlig_opptak'
    ) x
    order by x.rekkefolge desc
    limit 1;
  end if;

  if v_oppgave is null or v_antall < 1 then
    raise exception 'oppgave_ikke_funnet' using errcode = 'P0001';
  end if;

  return jsonb_build_object(
    'id', v_okt.id,
    'status', v_okt.status,
    'nummer', v_nummer,
    'antall', v_antall,
    'oppgave', v_oppgave,
    'deler', v_deler
  );
end;
$$;

create or replace function public.lagre_muntlig_vurdering(
  p_bruker_id uuid,
  p_okt_id uuid,
  p_oppgave_id uuid,
  p_svar_tekst text,
  p_svar_lyd_url text,
  p_vurdering jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_svar_id uuid;
  v_vurdering_id uuid;
  v_punkter text[];
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'ikke_innlogget' using errcode = 'P0001';
  end if;

  if p_bruker_id is null then
    raise exception 'ikke_innlogget' using errcode = 'P0001';
  end if;

  if not exists (
    select 1
    from public.brukerprofil b
    join public.plan_rettigheter r
      on r.plan_id = b.abonnement_plan_id
    where b.id = p_bruker_id
      and r.rettighet = 'muntlig_ki_vurdering'
  ) then
    raise exception 'mangler_muntlig' using errcode = 'P0001';
  end if;

  select status into v_status
  from public.okt_tilstand
  where id = p_okt_id
    and bruker_id = p_bruker_id
    and ferdighet = 'muntlig';

  if not found then
    raise exception 'okt_ikke_funnet' using errcode = 'P0001';
  end if;

  if v_status <> 'pagaende' then
    raise exception 'okt_ikke_aktiv' using errcode = 'P0001';
  end if;

  if not exists (
    select 1
    from public.okt_oppgaver oo
    join public.oppgaver o on o.id = oo.oppgave_id
    where oo.okt_id = p_okt_id
      and oo.oppgave_id = p_oppgave_id
      and o.ferdighet = 'muntlig'
      and o.type = 'muntlig_opptak'
      and o.status = 'publisert'
  ) then
    raise exception 'oppgave_ikke_i_okt' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_bruker_id::text || ':' || p_oppgave_id::text, 0)
  );

  if exists (
    select 1
    from public.bruker_oppgave_historikk
    where bruker_id = p_bruker_id
      and oppgave_id = p_oppgave_id
  ) then
    raise exception 'allerede_besvart' using errcode = 'P0001';
  end if;

  if p_svar_tekst is null
     or char_length(btrim(p_svar_tekst)) < 1
     or char_length(btrim(p_svar_tekst)) > 4000 then
    raise exception 'ugyldig_svar' using errcode = 'P0001';
  end if;

  if p_svar_lyd_url is null
     or p_svar_lyd_url !~ (
       '^muntlig-opptak/'
       || p_bruker_id::text
       || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(webm|wav|mp3|ogg)$'
     ) then
    raise exception 'mangler_lyd' using errcode = 'P0001';
  end if;

  if not public.gyldig_muntlig_vurdering(p_vurdering) then
    raise exception 'ugyldig_svar' using errcode = 'P0001';
  end if;

  select coalesce(array_agg(t.elem #>> '{}' order by t.ord), '{}')
    into v_punkter
  from jsonb_array_elements(p_vurdering->'forbedringspunkter')
    with ordinality as t(elem, ord);

  if exists (
    select 1
    from public.okt_oppgaver tidligere
    where tidligere.okt_id = p_okt_id
      and tidligere.rekkefolge < (
        select denne.rekkefolge
        from public.okt_oppgaver denne
        where denne.okt_id = p_okt_id
          and denne.oppgave_id = p_oppgave_id
      )
      and not exists (
        select 1
        from public.bruker_svar s
        where s.okt_id = p_okt_id
          and s.oppgave_id = tidligere.oppgave_id
          and s.bruker_id = p_bruker_id
      )
  ) then
    raise exception 'oppgave_ikke_i_okt' using errcode = 'P0001';
  end if;

  insert into public.bruker_svar (
    bruker_id, oppgave_id, okt_id, svar_tekst, svar_lyd_url
  ) values (
    p_bruker_id,
    p_oppgave_id,
    p_okt_id,
    btrim(p_svar_tekst),
    p_svar_lyd_url
  )
  returning id into v_svar_id;

  insert into public.muntlig_vurdering (
    bruker_svar_id,
    formidling,
    sprakligekriterier,
    samlet_niva,
    forbedringspunkter,
    positivt_element,
    tilbakemelding_til_elev,
    usikker_vurdering,
    usikker_pga_lyd
  ) values (
    v_svar_id,
    p_vurdering->'formidling',
    p_vurdering->'sprakligekriterier',
    p_vurdering->>'samlet_niva',
    v_punkter,
    btrim(p_vurdering->>'positivt_element'),
    btrim(p_vurdering->>'tilbakemelding_til_elev'),
    (p_vurdering->>'usikker_vurdering')::boolean,
    true
  )
  returning id into v_vurdering_id;

  insert into public.bruker_oppgave_historikk (bruker_id, oppgave_id)
  values (p_bruker_id, p_oppgave_id);

  update public.oppgaver
  set ganger_servert = ganger_servert + 1
  where id = p_oppgave_id;

  update public.okt_tilstand
  set status = case
        when not exists (
          select 1
          from public.okt_oppgaver oo
          where oo.okt_id = p_okt_id
            and not exists (
              select 1
              from public.bruker_svar s
              where s.okt_id = oo.okt_id
                and s.oppgave_id = oo.oppgave_id
                and s.bruker_id = p_bruker_id
            )
        ) then 'fullfort'
        else status
      end,
      siste_posisjon = (
        select count(*)::int
        from public.bruker_svar s
        where s.okt_id = p_okt_id
          and s.bruker_id = p_bruker_id
      ),
      sist_lagret = now()
  where id = p_okt_id;

  return v_vurdering_id;
end;
$$;
notify pgrst, 'reload schema';
