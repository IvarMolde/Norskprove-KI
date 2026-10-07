-- ============================================================
-- Fase 6: planbytte og pause
-- ============================================================
-- Beløpet leses fra abonnement_plan. Planen endres bare når
-- ordren er betalt, og bare fra service_role.
-- Pause endrer ikke radene i okt_oppgaver.
-- Se beslutningen i ROADMAP.md.

create table public.betaling (
  id uuid primary key default gen_random_uuid(),
  bruker_id uuid not null references auth.users(id),
  plan_id text not null check (plan_id in ('plan_499', 'plan_699', 'plan_899')),
  belop_kr int not null check (belop_kr > 0),
  status text not null default 'venter' check (status in ('venter', 'betalt', 'avbrutt')),
  opprettet_dato timestamptz not null default now(),
  betalt_dato timestamptz
);

alter table public.betaling enable row level security;

create policy "Bruker ser egen betaling"
  on public.betaling for select using (bruker_id = auth.uid());

create or replace function public.beskytt_brukerplan()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.abonnement_plan_id is distinct from old.abonnement_plan_id
     and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'mangler_rettighet' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists brukerprofil_beskytt_plan on public.brukerprofil;

create trigger brukerprofil_beskytt_plan
  before update on public.brukerprofil
  for each row execute function public.beskytt_brukerplan();

create or replace function public.start_betaling(p_plan_id text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_pris int;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'ikke_innlogget' using errcode = 'P0001';
  end if;

  if p_plan_id not in ('plan_499', 'plan_699', 'plan_899') then
    raise exception 'ugyldig_plan' using errcode = 'P0001';
  end if;

  select pris_kr into v_pris
  from public.abonnement_plan
  where id = p_plan_id;

  if v_pris is null or v_pris <= 0 then
    raise exception 'ugyldig_plan' using errcode = 'P0001';
  end if;

  if not exists (select 1 from public.brukerprofil where id = v_uid) then
    raise exception 'mangler_profil' using errcode = 'P0001';
  end if;

  update public.betaling
  set status = 'avbrutt'
  where bruker_id = v_uid
    and status = 'venter';

  insert into public.betaling (bruker_id, plan_id, belop_kr)
  values (v_uid, p_plan_id, v_pris)
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.bekreft_betaling(p_betaling_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bruker uuid;
  v_plan text;
  v_status text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'ikke_innlogget' using errcode = 'P0001';
  end if;

  select bruker_id, plan_id, status
    into v_bruker, v_plan, v_status
  from public.betaling
  where id = p_betaling_id;

  if not found then
    raise exception 'betaling_ikke_funnet' using errcode = 'P0001';
  end if;

  if v_status = 'betalt' then
    return v_plan;
  end if;

  if v_status <> 'venter' then
    raise exception 'ugyldig_plan' using errcode = 'P0001';
  end if;

  update public.betaling
  set status = 'betalt',
      betalt_dato = now()
  where id = p_betaling_id;

  update public.brukerprofil
  set abonnement_plan_id = v_plan
  where id = v_bruker;

  if not found then
    raise exception 'mangler_profil' using errcode = 'P0001';
  end if;

  return v_plan;
end;
$$;

create or replace function public.pause_okt(p_okt_id uuid)
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

  if not exists (
    select 1
    from public.brukerprofil b
    join public.plan_rettigheter r
      on r.plan_id = b.abonnement_plan_id
    where b.id = v_uid
      and r.rettighet = 'pause_gjenoppta'
  ) then
    raise exception 'ingen_pause' using errcode = 'P0001';
  end if;

  select status into v_status
  from public.okt_tilstand
  where id = p_okt_id
    and bruker_id = v_uid;

  if not found then
    raise exception 'okt_ikke_funnet' using errcode = 'P0001';
  end if;

  if v_status <> 'pagaende' then
    raise exception 'okt_ikke_aktiv' using errcode = 'P0001';
  end if;

  update public.okt_tilstand
  set status = 'avbrutt_lagret',
      sist_lagret = now()
  where id = p_okt_id;
end;
$$;

create or replace function public.gjenoppta_okt(p_okt_id uuid)
returns uuid
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

  if not exists (
    select 1
    from public.brukerprofil b
    join public.plan_rettigheter r
      on r.plan_id = b.abonnement_plan_id
    where b.id = v_uid
      and r.rettighet = 'pause_gjenoppta'
  ) then
    raise exception 'ingen_pause' using errcode = 'P0001';
  end if;

  select status into v_status
  from public.okt_tilstand
  where id = p_okt_id
    and bruker_id = v_uid;

  if not found then
    raise exception 'okt_ikke_funnet' using errcode = 'P0001';
  end if;

  if v_status = 'pagaende' then
    return p_okt_id;
  end if;

  if v_status <> 'avbrutt_lagret' then
    raise exception 'okt_ikke_aktiv' using errcode = 'P0001';
  end if;

  update public.okt_tilstand
  set status = 'pagaende',
      sist_lagret = now()
  where id = p_okt_id;

  return p_okt_id;
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

revoke all on function public.beskytt_brukerplan() from public;
revoke all on function public.beskytt_brukerplan() from anon;
revoke all on function public.beskytt_brukerplan() from authenticated;

revoke all on function public.start_betaling(text) from public;
revoke all on function public.start_betaling(text) from anon;
grant execute on function public.start_betaling(text) to authenticated;

revoke all on function public.bekreft_betaling(uuid) from public;
revoke all on function public.bekreft_betaling(uuid) from anon;
revoke all on function public.bekreft_betaling(uuid) from authenticated;
grant execute on function public.bekreft_betaling(uuid) to service_role;

revoke all on function public.pause_okt(uuid) from public;
revoke all on function public.pause_okt(uuid) from anon;
grant execute on function public.pause_okt(uuid) to authenticated;

revoke all on function public.gjenoppta_okt(uuid) from public;
revoke all on function public.gjenoppta_okt(uuid) from anon;
grant execute on function public.gjenoppta_okt(uuid) to authenticated;

revoke all on function public.start_leseokt() from public;
revoke all on function public.start_leseokt() from anon;
grant execute on function public.start_leseokt() to authenticated;
