-- ============================================================
-- Pause for vanlig lytting og skriving
-- ============================================================
-- Adaptiv lytting er en annen økt. Se beslutningen i ROADMAP.md.

create or replace function public.start_lytteokt()
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
  v_oppgave record;
  v_pos int := 0;
begin
  if v_uid is null then
    raise exception 'ikke_innlogget' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('start_lytteokt:' || v_uid::text, 0));

  select id into v_okt
  from public.okt_tilstand
  where bruker_id = v_uid
    and ferdighet = 'lytting'
    and status = 'pagaende'
    and not exists (
      select 1
      from public.prove_sesjon ps
      where ps.okt_id = okt_tilstand.id
    )
  order by startet desc
  limit 1;

  if v_okt is not null then
    return v_okt;
  end if;

  select id into v_okt
  from public.okt_tilstand
  where bruker_id = v_uid
    and ferdighet = 'lytting'
    and status = 'avbrutt_lagret'
    and not exists (
      select 1
      from public.prove_sesjon ps
      where ps.okt_id = okt_tilstand.id
    )
  order by startet desc
  limit 1;

  if v_okt is not null then
    if not exists (
      select 1
      from public.brukerprofil b
      join public.plan_rettigheter r
        on r.plan_id = b.abonnement_plan_id
      where b.id = v_uid
        and r.rettighet = 'pause_gjenoppta'
    ) then
      raise exception 'okt_pauset' using errcode = 'P0001';
    end if;

    update public.okt_tilstand
    set status = 'pagaende',
        sist_lagret = now()
    where id = v_okt;

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

  insert into public.okt_tilstand (bruker_id, ferdighet)
  values (v_uid, 'lytting')
  returning id into v_okt;

  for v_oppgave in
    select o.id
    from public.oppgaver o
    where o.status = 'publisert'
      and o.ferdighet = 'lytting'
      and o.type = 'pastand_korrekt'
      and o.lyd_url ~ '^/lyd/[a-z0-9-]+\.mp3$'
      and nullif(btrim(o.transkripsjon), '') is not null
      and not exists (
        select 1
        from public.bruker_oppgave_historikk h
        where h.bruker_id = v_uid
          and h.oppgave_id = o.id
      )
    order by o.ganger_servert, o.opprettet_dato
    limit 18
  loop
    v_pos := v_pos + 1;
    insert into public.okt_oppgaver (okt_id, oppgave_id, rekkefolge)
    values (v_okt, v_oppgave.id, v_pos);
  end loop;

  if v_pos = 0 then
    raise exception 'ingen_oppgaver' using errcode = 'P0001';
  end if;

  return v_okt;
end;
$$;


create or replace function public.start_skriveokt()
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
  v_oppgave uuid;
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

  perform pg_advisory_xact_lock(hashtextextended('start_skriveokt:' || v_uid::text, 0));

  select id into v_okt
  from public.okt_tilstand
  where bruker_id = v_uid
    and ferdighet = 'skriving'
    and status = 'pagaende'
  order by startet desc
  limit 1;

  if v_okt is not null then
    return v_okt;
  end if;

  select id into v_okt
  from public.okt_tilstand
  where bruker_id = v_uid
    and ferdighet = 'skriving'
    and status = 'avbrutt_lagret'
  order by startet desc
  limit 1;

  if v_okt is not null then
    if not exists (
      select 1
      from public.brukerprofil b
      join public.plan_rettigheter r
        on r.plan_id = b.abonnement_plan_id
      where b.id = v_uid
        and r.rettighet = 'pause_gjenoppta'
    ) then
      raise exception 'okt_pauset' using errcode = 'P0001';
    end if;

    update public.okt_tilstand
    set status = 'pagaende',
        sist_lagret = now()
    where id = v_okt;

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

  select o.id into v_oppgave
  from public.oppgaver o
  where o.status = 'publisert'
    and o.ferdighet = 'skriving'
    and o.type = 'fritekst'
    and o.innhold->>'oppgavetype' in (
      'kort_melding', 'bildebeskrivelse', 'kjent_tema', 'meningsytring'
    )
    and o.innhold->>'nivagruppe' in ('A1-A2', 'A2-B1', 'B1-B2')
    and (o.innhold->>'min_ord') ~ '^[0-9]+$'
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

  if v_oppgave is null then
    raise exception 'ingen_oppgaver' using errcode = 'P0001';
  end if;

  insert into public.okt_tilstand (bruker_id, ferdighet)
  values (v_uid, 'skriving')
  returning id into v_okt;

  insert into public.okt_oppgaver (okt_id, oppgave_id, rekkefolge)
  values (v_okt, v_oppgave, 1);

  return v_okt;
end;
$$;

