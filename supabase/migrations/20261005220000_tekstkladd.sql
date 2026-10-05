-- ============================================================
-- Fase 8: teksten lagres mens eleven skriver
-- ============================================================
-- Gjelder skriving og muntlig fase 1. Kladden er ikke et svar.
-- Modellen kalles ikke. Økten blir ikke ferdig. Se ROADMAP.md.

create or replace function public.lagre_tekstkladd(
  p_okt_id uuid,
  p_oppgave_id uuid,
  p_tekst text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_okt public.okt_tilstand%rowtype;
  v_tekst text := btrim(coalesce(p_tekst, ''));
begin
  if v_uid is null then
    raise exception 'ikke_innlogget' using errcode = 'P0001';
  end if;

  select * into v_okt
  from public.okt_tilstand
  where id = p_okt_id
    and bruker_id = v_uid;

  if not found then
    raise exception 'okt_ikke_funnet' using errcode = 'P0001';
  end if;

  if v_okt.status <> 'pagaende' then
    raise exception 'okt_ikke_aktiv' using errcode = 'P0001';
  end if;

  if v_okt.ferdighet = 'skriving' then
    if not exists (
      select 1
      from public.brukerprofil b
      join public.plan_rettigheter r
        on r.plan_id = b.abonnement_plan_id
      where b.id = v_uid
        and r.rettighet = 'skriftlig_ki_vurdering'
    ) then
      raise exception 'mangler_rettighet' using errcode = 'P0001';
    end if;

    if not exists (
      select 1
      from public.okt_oppgaver oo
      join public.oppgaver o on o.id = oo.oppgave_id
      where oo.okt_id = p_okt_id
        and oo.oppgave_id = p_oppgave_id
        and o.ferdighet = 'skriving'
        and o.type = 'fritekst'
        and o.status = 'publisert'
    ) then
      raise exception 'oppgave_ikke_i_okt' using errcode = 'P0001';
    end if;
  elsif v_okt.ferdighet = 'muntlig' then
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
          join public.muntlig_vurdering v on v.bruker_svar_id = s.id
          where s.okt_id = p_okt_id
            and s.oppgave_id = tidligere.oppgave_id
            and s.bruker_id = v_uid
        )
    ) then
      raise exception 'oppgave_ikke_i_okt' using errcode = 'P0001';
    end if;
  else
    raise exception 'oppgave_ikke_i_okt' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(v_uid::text || ':' || p_oppgave_id::text, 0)
  );

  if exists (
    select 1
    from public.bruker_oppgave_historikk
    where bruker_id = v_uid
      and oppgave_id = p_oppgave_id
  ) then
    raise exception 'allerede_besvart' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.bruker_svar s
    where s.bruker_id = v_uid
      and s.okt_id = p_okt_id
      and s.oppgave_id = p_oppgave_id
      and (
        exists (
          select 1
          from public.muntlig_vurdering v
          where v.bruker_svar_id = s.id
        )
        or exists (
          select 1
          from public.skriftlig_vurdering v
          where v.bruker_svar_id = s.id
        )
      )
  ) then
    raise exception 'allerede_besvart' using errcode = 'P0001';
  end if;

  if char_length(v_tekst) > 4000 then
    raise exception 'ugyldig_svar' using errcode = 'P0001';
  end if;

  delete from public.bruker_svar s
  where s.bruker_id = v_uid
    and s.okt_id = p_okt_id
    and s.oppgave_id = p_oppgave_id
    and s.svar_lyd_url is null
    and not exists (
      select 1 from public.muntlig_vurdering v where v.bruker_svar_id = s.id
    )
    and not exists (
      select 1 from public.skriftlig_vurdering v where v.bruker_svar_id = s.id
    );

  if char_length(v_tekst) > 0 then
    insert into public.bruker_svar (bruker_id, oppgave_id, okt_id, svar_tekst)
    values (v_uid, p_oppgave_id, p_okt_id, v_tekst);
  end if;

  update public.okt_tilstand
  set sist_lagret = now()
  where id = p_okt_id;
end;
$$;

revoke all on function public.lagre_tekstkladd(uuid, uuid, text) from public;
revoke all on function public.lagre_tekstkladd(uuid, uuid, text) from anon;
grant execute on function public.lagre_tekstkladd(uuid, uuid, text) to authenticated;

create or replace function public.hent_skriveokt(p_okt_id uuid)
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
      and r.rettighet = 'skriftlig_ki_vurdering'
  ) then
    raise exception 'mangler_rettighet' using errcode = 'P0001';
  end if;

  select * into v_okt
  from public.okt_tilstand
  where id = p_okt_id
    and bruker_id = v_uid
    and ferdighet = 'skriving';

  if not found then
    raise exception 'okt_ikke_funnet' using errcode = 'P0001';
  end if;

  select jsonb_build_object(
    'id', o.id,
    'tittel', o.innhold->>'tittel',
    'tekst', o.innhold->>'tekst',
    'oppgavetype', o.innhold->>'oppgavetype',
    'nivagruppe', o.innhold->>'nivagruppe',
    'min_ord', (o.innhold->>'min_ord')::int,
    'svar', case when v.id is null then null else svar.svar_tekst end,
    'kladd', case when v.id is null then svar.svar_tekst else null end,
    'vurdering', case
      when v.id is null then null
      else jsonb_build_object(
        'samlet_niva', v.samlet_niva,
        'forbedringspunkter', to_jsonb(v.forbedringspunkter),
        'positivt_element', v.positivt_element,
        'tilbakemelding_til_elev', v.tilbakemelding_til_elev,
        'usikker_vurdering', v.usikker_vurdering
      )
    end
  )
  into v_oppgave
  from public.okt_oppgaver oo
  join public.oppgaver o on o.id = oo.oppgave_id
  left join lateral (
    select s.id, s.svar_tekst
    from public.bruker_svar s
    where s.okt_id = v_okt.id
      and s.oppgave_id = o.id
      and s.bruker_id = v_uid
    order by s.innsendt_dato desc
    limit 1
  ) svar on true
  left join public.skriftlig_vurdering v on v.bruker_svar_id = svar.id
  where oo.okt_id = v_okt.id
    and o.ferdighet = 'skriving'
    and o.type = 'fritekst'
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
    'svar', case when v.id is null then null else svar.svar_tekst end,
    'kladd', case when v.id is null then svar.svar_tekst else null end,
    'har_lyd', coalesce(svar.svar_lyd_url is not null, false),
    'larer', case
      when lk.bruker_svar_id is null then null
      else jsonb_build_object('niva', lk.niva, 'kommentar', lk.kommentar)
    end,
    'vurdering', case
      when v.id is null then null
      else jsonb_build_object(
        'formidling', v.formidling,
        'sprakligekriterier', v.sprakligekriterier,
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

create or replace function public.lagre_skriftlig_vurdering(
  p_bruker_id uuid,
  p_okt_id uuid,
  p_oppgave_id uuid,
  p_svar_tekst text,
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
      and r.rettighet = 'skriftlig_ki_vurdering'
  ) then
    raise exception 'mangler_rettighet' using errcode = 'P0001';
  end if;

  select status into v_status
  from public.okt_tilstand
  where id = p_okt_id
    and bruker_id = p_bruker_id
    and ferdighet = 'skriving';

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
      and o.ferdighet = 'skriving'
      and o.type = 'fritekst'
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

  if not public.gyldig_skriftlig_vurdering(p_vurdering) then
    raise exception 'ugyldig_svar' using errcode = 'P0001';
  end if;

  select coalesce(array_agg(t.elem #>> '{}' order by t.ord), '{}')
    into v_punkter
  from jsonb_array_elements(p_vurdering->'forbedringspunkter')
    with ordinality as t(elem, ord);

  delete from public.bruker_svar s
  where s.bruker_id = p_bruker_id
    and s.okt_id = p_okt_id
    and s.oppgave_id = p_oppgave_id
    and s.svar_lyd_url is null
    and not exists (
      select 1 from public.skriftlig_vurdering v where v.bruker_svar_id = s.id
    );

  insert into public.bruker_svar (bruker_id, oppgave_id, okt_id, svar_tekst)
  values (p_bruker_id, p_oppgave_id, p_okt_id, btrim(p_svar_tekst))
  returning id into v_svar_id;

  insert into public.skriftlig_vurdering (
    bruker_svar_id,
    kriterier,
    samlet_niva,
    forbedringspunkter,
    positivt_element,
    tilbakemelding_til_elev,
    usikker_vurdering
  ) values (
    v_svar_id,
    p_vurdering->'kriterier',
    p_vurdering->>'samlet_niva',
    v_punkter,
    btrim(p_vurdering->>'positivt_element'),
    btrim(p_vurdering->>'tilbakemelding_til_elev'),
    (p_vurdering->>'usikker_vurdering')::boolean
  )
  returning id into v_vurdering_id;

  insert into public.bruker_oppgave_historikk (bruker_id, oppgave_id)
  values (p_bruker_id, p_oppgave_id);

  update public.oppgaver
  set ganger_servert = ganger_servert + 1
  where id = p_oppgave_id;

  update public.okt_tilstand
  set status = 'fullfort',
      siste_posisjon = 1,
      sist_lagret = now()
  where id = p_okt_id;

  return v_vurdering_id;
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
        join public.muntlig_vurdering v on v.bruker_svar_id = s.id
        where s.okt_id = p_okt_id
          and s.oppgave_id = tidligere.oppgave_id
          and s.bruker_id = p_bruker_id
      )
  ) then
    raise exception 'oppgave_ikke_i_okt' using errcode = 'P0001';
  end if;

  delete from public.bruker_svar s
  where s.bruker_id = p_bruker_id
    and s.okt_id = p_okt_id
    and s.oppgave_id = p_oppgave_id
    and s.svar_lyd_url is null
    and not exists (
      select 1 from public.muntlig_vurdering v where v.bruker_svar_id = s.id
    );

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
              join public.muntlig_vurdering v on v.bruker_svar_id = s.id
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
        join public.muntlig_vurdering v on v.bruker_svar_id = s.id
        where s.okt_id = p_okt_id
          and s.bruker_id = p_bruker_id
      ),
      sist_lagret = now()
  where id = p_okt_id;

  return v_vurdering_id;
end;
$$;

notify pgrst, 'reload schema';
