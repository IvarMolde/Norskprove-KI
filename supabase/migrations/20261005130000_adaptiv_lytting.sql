-- ============================================================
-- Fase 8: adaptiv prøve i lytting
-- ============================================================
-- Samme terskler som lesing. Oppgavene er egne. Se ROADMAP.md.

insert into public.adaptiv_oppgave (oppgave_id, fase)
select id,
  case
    when nr between 1 and 6 then 'forprove1'
    when nr between 7 and 10 then 'forprove2_lett'
    when nr between 11 and 14 then 'forprove2_vanskelig'
    when nr between 15 and 16 then 'hovedprove_a1a2'
    when nr = 17 then 'hovedprove_a2b1'
    else 'hovedprove_b1b2'
  end
from (
  select o.id,
    row_number() over (order by o.opprettet_dato, o.id) as nr
  from public.oppgaver o
  where o.status = 'publisert'
    and o.ferdighet = 'lytting'
    and o.type = 'pastand_korrekt'
    and o.lyd_url ~ '^/lyd/[a-z0-9-]+\.mp3$'
    and nullif(btrim(o.transkripsjon), '') is not null
) nummerert
where nr <= 18;

do $$
begin
  if (select count(*) from public.adaptiv_oppgave a
      join public.oppgaver o on o.id = a.oppgave_id
      where o.ferdighet = 'lytting' and a.fase = 'forprove1') <> 6
    or (select count(*) from public.adaptiv_oppgave a
      join public.oppgaver o on o.id = a.oppgave_id
      where o.ferdighet = 'lytting' and a.fase = 'forprove2_lett') <> 4
    or (select count(*) from public.adaptiv_oppgave a
      join public.oppgaver o on o.id = a.oppgave_id
      where o.ferdighet = 'lytting' and a.fase = 'forprove2_vanskelig') <> 4
    or (select count(*) from public.adaptiv_oppgave a
      join public.oppgaver o on o.id = a.oppgave_id
      where o.ferdighet = 'lytting' and a.fase = 'hovedprove_a1a2') <> 2
    or (select count(*) from public.adaptiv_oppgave a
      join public.oppgaver o on o.id = a.oppgave_id
      where o.ferdighet = 'lytting' and a.fase = 'hovedprove_a2b1') <> 1
    or (select count(*) from public.adaptiv_oppgave a
      join public.oppgaver o on o.id = a.oppgave_id
      where o.ferdighet = 'lytting' and a.fase = 'hovedprove_b1b2') <> 1
  then
    raise exception 'adaptiv_lytting_mangler';
  end if;
end;
$$;

create or replace function public.adaptiv_tilstand(p_okt_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_rad jsonb;
begin
  if v_uid is null then
    raise exception 'ikke_innlogget' using errcode = 'P0001';
  end if;

  select jsonb_build_object(
    'id', o.id,
    'status', o.status,
    'ferdighet', s.ferdighet,
    'fase', s.fase,
    'niva_gruppe', s.niva_gruppe_tildelt,
    'oppgaver', coalesce((
      select jsonb_agg(t.oppgave_id)
      from (
        select oo.oppgave_id
        from public.okt_oppgaver oo
        join public.adaptiv_oppgave a
          on a.oppgave_id = oo.oppgave_id
         and a.fase = s.fase
        where oo.okt_id = o.id
        order by oo.rekkefolge
      ) t
    ), '[]'::jsonb)
  )
  into v_rad
  from public.okt_tilstand o
  join public.prove_sesjon s on s.okt_id = o.id
  where o.id = p_okt_id
    and o.bruker_id = v_uid;

  if v_rad is null then
    raise exception 'okt_ikke_funnet' using errcode = 'P0001';
  end if;

  return v_rad;
end;
$$;

create or replace function public.aktiv_adaptiv_prove(p_ferdighet text)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_okt uuid;
begin
  if v_uid is null then
    return null;
  end if;

  if p_ferdighet is null or p_ferdighet not in ('lesing', 'lytting') then
    return null;
  end if;

  select o.id into v_okt
  from public.prove_sesjon s
  join public.okt_tilstand o on o.id = s.okt_id
  where o.bruker_id = v_uid
    and o.ferdighet = p_ferdighet
    and s.ferdighet = p_ferdighet
    and o.status in ('pagaende', 'avbrutt_lagret')
  order by o.startet desc
  limit 1;

  return v_okt;
end;
$$;

drop function if exists public.start_adaptiv_prove();

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
    update public.okt_tilstand
    set status = 'pagaende',
        sist_lagret = now()
    where id = v_okt
      and status = 'avbrutt_lagret';
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

create or replace function public.videre_adaptiv_fase(p_okt_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_fase text;
  v_ferdighet text;
  v_niva text;
  v_status text;
  v_antall int;
  v_ubesvart int;
  v_poeng int;
  v_neste text;
  v_neste_niva text;
  v_oppgave uuid;
  v_pos int;
  v_for int;
begin
  if v_uid is null then
    raise exception 'ikke_innlogget' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('adaptiv:' || p_okt_id::text, 0));

  select s.fase, s.ferdighet, s.niva_gruppe_tildelt, o.status
    into v_fase, v_ferdighet, v_niva, v_status
  from public.prove_sesjon s
  join public.okt_tilstand o on o.id = s.okt_id
  where s.okt_id = p_okt_id
    and o.bruker_id = v_uid;

  if not found then
    raise exception 'okt_ikke_funnet' using errcode = 'P0001';
  end if;

  if v_fase = 'ferdig' or v_status = 'fullfort' then
    return public.adaptiv_tilstand(p_okt_id);
  end if;

  if v_status <> 'pagaende' then
    raise exception 'okt_ikke_aktiv' using errcode = 'P0001';
  end if;

  select count(*)::int,
    count(*) filter (
      where not exists (
        select 1
        from public.bruker_oppgave_historikk h
        where h.bruker_id = v_uid
          and h.oppgave_id = oo.oppgave_id
      )
    )::int
    into v_antall, v_ubesvart
  from public.okt_oppgaver oo
  join public.adaptiv_oppgave a
    on a.oppgave_id = oo.oppgave_id
   and a.fase = v_fase
  join public.oppgaver o
    on o.id = oo.oppgave_id
   and o.ferdighet = v_ferdighet
  where oo.okt_id = p_okt_id;

  if v_antall = 0 or v_ubesvart > 0 then
    return public.adaptiv_tilstand(p_okt_id);
  end if;

  select count(*)::int into v_poeng
  from public.okt_oppgaver oo
  join public.oppgaver o on o.id = oo.oppgave_id
  join public.adaptiv_oppgave a
    on a.oppgave_id = o.id
   and a.fase = v_fase
  join lateral (
    select s.svar_tekst::jsonb as svar
    from public.bruker_svar s
    where s.okt_id = p_okt_id
      and s.oppgave_id = o.id
      and s.bruker_id = v_uid
    order by s.innsendt_dato desc
    limit 1
  ) svar on true
  where oo.okt_id = p_okt_id
    and o.ferdighet = v_ferdighet
    and public.adaptiv_svar_er_riktig(o.type, o.innhold, svar.svar);

  if v_fase in ('hovedprove_a1a2', 'hovedprove_a2b1', 'hovedprove_b1b2') then
    update public.prove_sesjon
    set fase = 'ferdig',
        poengsum_hittil = v_poeng,
        fullfort = now()
    where okt_id = p_okt_id;

    update public.okt_tilstand
    set status = 'fullfort',
        sist_lagret = now()
    where id = p_okt_id;

    return public.adaptiv_tilstand(p_okt_id);
  end if;

  select t.neste_fase, t.neste_niva_gruppe
    into v_neste, v_neste_niva
  from public.adaptiv_terskler t
  where t.fase = v_fase
    and v_poeng between t.min_poeng and t.maks_poeng
  order by t.min_poeng
  limit 1;

  if v_neste is null then
    raise exception 'terskel_mangler' using errcode = 'P0001';
  end if;

  select coalesce(max(rekkefolge), 0) into v_for
  from public.okt_oppgaver
  where okt_id = p_okt_id;

  v_pos := v_for;

  for v_oppgave in
    select a.oppgave_id
    from public.adaptiv_oppgave a
    join public.oppgaver o on o.id = a.oppgave_id
    where a.fase = v_neste
      and o.ferdighet = v_ferdighet
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
    values (p_okt_id, v_oppgave, v_pos);
  end loop;

  if v_pos = v_for then
    raise exception 'ingen_oppgaver' using errcode = 'P0001';
  end if;

  update public.prove_sesjon
  set fase = v_neste,
      poengsum_hittil = v_poeng,
      niva_gruppe_tildelt = coalesce(v_neste_niva, niva_gruppe_tildelt)
  where okt_id = p_okt_id;

  return public.adaptiv_tilstand(p_okt_id);
end;
$$;

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

drop function if exists public.aktiv_adaptiv_prove();

revoke all on function public.aktiv_adaptiv_prove(text) from public;
revoke all on function public.aktiv_adaptiv_prove(text) from anon;
grant execute on function public.aktiv_adaptiv_prove(text) to authenticated;

revoke all on function public.start_adaptiv_prove(text) from public;
revoke all on function public.start_adaptiv_prove(text) from anon;
grant execute on function public.start_adaptiv_prove(text) to authenticated;

notify pgrst, 'reload schema';
