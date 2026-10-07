-- ============================================================
-- Fase 8: pause for muntlig fase 1 og adaptiv prøve
-- ============================================================
-- Samme oppgaver kommer tilbake. Pause gjør ikke økten ferdig.
-- Se beslutningen i ROADMAP.md.

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

  select id into v_okt
  from public.okt_tilstand
  where bruker_id = v_uid
    and ferdighet = 'muntlig'
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


create or replace function public.start_adaptiv_prove(p_ferdighet text)
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
  v_pos int := 0;
  v_status text;
begin
  if v_uid is null then
    raise exception 'ikke_innlogget' using errcode = 'P0001';
  end if;

  if p_ferdighet is null or p_ferdighet not in ('lesing', 'lytting') then
    raise exception 'ugyldig_ferdighet' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('start_adaptiv:' || p_ferdighet || ':' || v_uid::text, 0)
  );

  v_okt := public.aktiv_adaptiv_prove(p_ferdighet);
  if v_okt is not null then
    select status into v_status
    from public.okt_tilstand
    where id = v_okt;

    if v_status = 'avbrutt_lagret' then
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
      where id = v_okt
        and status = 'avbrutt_lagret';
    end if;

    return v_okt;
  end if;

  if not exists (
    select 1
    from public.brukerprofil b
    join public.plan_rettigheter r
      on r.plan_id = b.abonnement_plan_id
    where b.id = v_uid
      and r.rettighet = 'adaptiv_prove'
  ) then
    raise exception 'mangler_adaptiv' using errcode = 'P0001';
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
  values (v_uid, p_ferdighet)
  returning id into v_okt;

  insert into public.prove_sesjon (okt_id, ferdighet, fase)
  values (v_okt, p_ferdighet, 'forprove1');

  for v_oppgave in
    select a.oppgave_id
    from public.adaptiv_oppgave a
    join public.oppgaver o on o.id = a.oppgave_id
    where a.fase = 'forprove1'
      and o.ferdighet = p_ferdighet
      and o.status = 'publisert'
      and not exists (
        select 1
        from public.bruker_oppgave_historikk h
        where h.bruker_id = v_uid
          and h.oppgave_id = a.oppgave_id
      )
    order by o.opprettet_dato, o.id
  loop
    v_pos := v_pos + 1;
    insert into public.okt_oppgaver (okt_id, oppgave_id, rekkefolge)
    values (v_okt, v_oppgave, v_pos);
  end loop;

  if v_pos = 0 then
    raise exception 'ingen_oppgaver' using errcode = 'P0001';
  end if;

  return v_okt;
end;
$$;

