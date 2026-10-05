-- ============================================================
-- Fase 8: første adaptive prøve er lesing
-- ============================================================
-- Forgreningen følger adaptiv_terskler. Banken har bare A2.
-- Se beslutningen i ROADMAP.md.

create table public.adaptiv_oppgave (
  oppgave_id uuid primary key references public.oppgaver(id) on delete cascade,
  fase text not null check (fase in (
    'forprove1', 'forprove2_lett', 'forprove2_vanskelig',
    'hovedprove_a1a2', 'hovedprove_a2b1', 'hovedprove_b1b2'
  ))
);

alter table public.adaptiv_oppgave enable row level security;

insert into public.adaptiv_oppgave (oppgave_id, fase)
select id,
  case
    when nr between 1 and 8 then 'forprove1'
    when nr between 9 and 12 then 'forprove2_lett'
    when nr between 13 and 16 then 'forprove2_vanskelig'
    when nr between 17 and 18 then 'hovedprove_a1a2'
    when nr = 19 then 'hovedprove_a2b1'
    else 'hovedprove_b1b2'
  end
from (
  select o.id,
    row_number() over (order by o.opprettet_dato, o.id) as nr
  from public.oppgaver o
  where o.status = 'publisert'
    and o.ferdighet = 'lesing'
    and o.type in (
      'pastand_korrekt', 'fyll_inn', 'synonym', 'antonym', 'rekkefolge'
    )
) nummerert
where nr <= 20;

do $$
begin
  if (select count(*) from public.adaptiv_oppgave where fase = 'forprove1') <> 8
    or (select count(*) from public.adaptiv_oppgave where fase = 'forprove2_lett') <> 4
    or (select count(*) from public.adaptiv_oppgave where fase = 'forprove2_vanskelig') <> 4
    or (select count(*) from public.adaptiv_oppgave where fase = 'hovedprove_a1a2') <> 2
    or (select count(*) from public.adaptiv_oppgave where fase = 'hovedprove_a2b1') <> 1
    or (select count(*) from public.adaptiv_oppgave where fase = 'hovedprove_b1b2') <> 1
  then
    raise exception 'adaptiv_oppgave_mangler';
  end if;
end;
$$;

drop policy if exists "Bruker ser og oppdaterer egen adaptiv sesjon" on public.prove_sesjon;

create policy "Bruker ser egen adaptiv sesjon"
  on public.prove_sesjon for select
  using (
    exists (
      select 1
      from public.okt_tilstand o
      where o.id = okt_id
        and o.bruker_id = auth.uid()
    )
  );

create or replace function public.adaptiv_svar_er_riktig(
  p_type text,
  p_innhold jsonb,
  p_svar jsonb
)
returns boolean
language plpgsql
stable
set search_path = public
as $$
declare
  v_mulig int;
  v_del int;
begin
  if p_svar is null then
    return false;
  end if;

  if p_type = 'pastand_korrekt' then
    v_mulig := coalesce(jsonb_array_length(p_innhold->'pastander'), 0);
    if v_mulig = 0 then
      return false;
    end if;
    select count(*)::int into v_del
    from jsonb_array_elements(p_innhold->'pastander') as p(pastand)
    join jsonb_array_elements(p_svar->'valg') as v(valg)
      on v.valg->>'id' = p.pastand->>'id'
    where v.valg->>'svar' = p.pastand->>'korrekt';
    return v_del = v_mulig;
  end if;

  if p_type = 'fyll_inn' then
    v_mulig := coalesce(jsonb_array_length(p_innhold->'fasit'), 0);
    if v_mulig = 0 then
      return false;
    end if;
    select count(*)::int into v_del
    from jsonb_array_elements(p_innhold->'fasit') as f(fasit)
    where exists (
      select 1
      from jsonb_array_elements(p_svar->'hull') as h(hull)
      cross join jsonb_array_elements_text(f.fasit->'ord') as o(ord)
      where h.hull->>'id' = f.fasit->>'id'
        and public.normaliser_ord(h.hull->>'svar') = public.normaliser_ord(o.ord)
    );
    return v_del = v_mulig;
  end if;

  if p_type in ('synonym', 'antonym') then
    return p_svar->>'valgId' = p_innhold->>'korrekt';
  end if;

  if p_type = 'rekkefolge' then
    return p_svar->'rekkefolge' = p_innhold->'riktig';
  end if;

  return false;
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

create or replace function public.aktiv_adaptiv_prove()
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

  select o.id into v_okt
  from public.prove_sesjon s
  join public.okt_tilstand o on o.id = s.okt_id
  where o.bruker_id = v_uid
    and o.status in ('pagaende', 'avbrutt_lagret')
  order by o.startet desc
  limit 1;

  return v_okt;
end;
$$;

create or replace function public.start_adaptiv_prove()
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

  perform pg_advisory_xact_lock(hashtextextended('start_adaptiv:' || v_uid::text, 0));

  v_okt := public.aktiv_adaptiv_prove();
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
  values (v_uid, 'lesing')
  returning id into v_okt;

  insert into public.prove_sesjon (okt_id, ferdighet, fase)
  values (v_okt, 'lesing', 'forprove1');

  for v_oppgave in
    select a.oppgave_id
    from public.adaptiv_oppgave a
    join public.oppgaver o on o.id = a.oppgave_id
    where a.fase = 'forprove1'
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

create or replace function public.hent_adaptiv_prove(p_okt_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  return public.adaptiv_tilstand(p_okt_id);
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

  select s.fase, s.niva_gruppe_tildelt, o.status
    into v_fase, v_niva, v_status
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

create or replace function public.fullfor_okt(p_okt_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_status text;
begin
  if v_uid is null then
    raise exception 'ikke_innlogget' using errcode = 'P0001';
  end if;

  select status into v_status
  from public.okt_tilstand
  where id = p_okt_id
    and bruker_id = v_uid;

  if not found then
    raise exception 'okt_ikke_funnet' using errcode = 'P0001';
  end if;

  if v_status = 'fullfort' then
    return;
  end if;

  if exists (
    select 1
    from public.prove_sesjon
    where okt_id = p_okt_id
  ) then
    raise exception 'adaptiv_pagaar' using errcode = 'P0001';
  end if;

  if v_status <> 'pagaende' then
    raise exception 'okt_ikke_aktiv' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.okt_oppgaver oo
    where oo.okt_id = p_okt_id
      and not exists (
        select 1
        from public.bruker_oppgave_historikk h
        where h.bruker_id = v_uid
          and h.oppgave_id = oo.oppgave_id
      )
  ) then
    raise exception 'ikke_ferdig' using errcode = 'P0001';
  end if;

  update public.okt_tilstand
  set status = 'fullfort',
      sist_lagret = now()
  where id = p_okt_id;
end;
$$;

create or replace function public.start_leseokt()
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

  perform pg_advisory_xact_lock(hashtextextended('start_leseokt:' || v_uid::text, 0));

  select id into v_okt
  from public.okt_tilstand
  where bruker_id = v_uid
    and ferdighet = 'lesing'
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
    and ferdighet = 'lesing'
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
  values (v_uid, 'lesing')
  returning id into v_okt;

  for v_oppgave in
    with kandidater as (
      select
        o.id,
        o.type,
        row_number() over (
          partition by o.type
          order by o.ganger_servert, o.opprettet_dato
        ) as nr
      from public.oppgaver o
      where o.status = 'publisert'
        and o.ferdighet = 'lesing'
        and o.type in (
          'pastand_korrekt', 'fyll_inn', 'synonym', 'antonym', 'rekkefolge'
        )
        and not exists (
          select 1
          from public.bruker_oppgave_historikk h
          where h.bruker_id = v_uid
            and h.oppgave_id = o.id
        )
    )
    select id
    from kandidater
    where nr <= 6
    order by nr,
      case type
        when 'pastand_korrekt' then 1
        when 'fyll_inn' then 2
        when 'synonym' then 3
        when 'antonym' then 4
        when 'rekkefolge' then 5
        else 6
      end
    limit 15
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

revoke all on function public.adaptiv_svar_er_riktig(text, jsonb, jsonb) from public;
revoke all on function public.adaptiv_svar_er_riktig(text, jsonb, jsonb) from anon;
revoke all on function public.adaptiv_svar_er_riktig(text, jsonb, jsonb) from authenticated;

revoke all on function public.adaptiv_tilstand(uuid) from public;
revoke all on function public.adaptiv_tilstand(uuid) from anon;
revoke all on function public.adaptiv_tilstand(uuid) from authenticated;

revoke all on function public.aktiv_adaptiv_prove() from public;
revoke all on function public.aktiv_adaptiv_prove() from anon;
grant execute on function public.aktiv_adaptiv_prove() to authenticated;

revoke all on function public.start_adaptiv_prove() from public;
revoke all on function public.start_adaptiv_prove() from anon;
grant execute on function public.start_adaptiv_prove() to authenticated;

revoke all on function public.hent_adaptiv_prove(uuid) from public;
revoke all on function public.hent_adaptiv_prove(uuid) from anon;
grant execute on function public.hent_adaptiv_prove(uuid) to authenticated;

revoke all on function public.videre_adaptiv_fase(uuid) from public;
revoke all on function public.videre_adaptiv_fase(uuid) from anon;
grant execute on function public.videre_adaptiv_fase(uuid) to authenticated;
