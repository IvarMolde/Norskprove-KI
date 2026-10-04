-- ============================================================
-- Fase 5: første skriveøkt (fritekst, kort melding)
-- ============================================================
-- Én håndskrevet oppgave. Fasit finnes ikke. Vurderingen skrives
-- bare av lagre_skriftlig_vurdering, og bare for service_role.
-- Eleven kan ikke sette inn i skriftlig_vurdering.
-- Se kontrakten i ROADMAP.md.

create or replace function public.gyldig_skriftlig_vurdering(p jsonb)
returns boolean
language plpgsql
stable
set search_path = public
as $$
declare
  v_navn text;
  v_k jsonb;
  v_punkt jsonb;
  v_niva text[] := array['Under A1', 'A1', 'A2', 'B1', 'B2'];
  v_antall int := 0;
begin
  if p is null or jsonb_typeof(p) <> 'object' then
    return false;
  end if;

  if not (p->>'samlet_niva' = any (v_niva)) then
    return false;
  end if;

  if jsonb_typeof(p->'usikker_vurdering') <> 'boolean' then
    return false;
  end if;

  if nullif(btrim(p->>'tilbakemelding_til_elev'), '') is null then
    return false;
  end if;

  if nullif(btrim(p->>'positivt_element'), '') is null then
    return false;
  end if;

  if jsonb_typeof(p->'forbedringspunkter') <> 'array'
     or jsonb_array_length(p->'forbedringspunkter') <> 3 then
    return false;
  end if;

  for v_punkt in
    select elem
    from jsonb_array_elements(p->'forbedringspunkter') as t(elem)
  loop
    if jsonb_typeof(v_punkt) <> 'string'
       or nullif(btrim(v_punkt #>> '{}'), '') is null then
      return false;
    end if;
  end loop;

  if jsonb_typeof(p->'kriterier') <> 'object' then
    return false;
  end if;

  foreach v_navn in array array[
    'tekstoppbygging', 'rettskriving', 'tegnsetting', 'ordforrad', 'grammatikk'
  ]
  loop
    v_k := p->'kriterier'->v_navn;
    if v_k is null or jsonb_typeof(v_k) <> 'object' then
      return false;
    end if;
    if not (v_k->>'niva' = any (v_niva)) then
      return false;
    end if;
    if nullif(btrim(v_k->>'begrunnelse'), '') is null then
      return false;
    end if;
    v_antall := v_antall + 1;
  end loop;

  return v_antall = 5;
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
    'svar', svar.svar_tekst,
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

-- Payloaden er sensorens vurdering. Derfor kan ikke eleven kalle
-- funksjonen. Serveren sender innlogget bruker-id etter modellkallet.
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

revoke all on function public.gyldig_skriftlig_vurdering(jsonb) from public;
revoke all on function public.gyldig_skriftlig_vurdering(jsonb) from anon;
revoke all on function public.gyldig_skriftlig_vurdering(jsonb) from authenticated;

revoke all on function public.start_skriveokt() from public;
revoke all on function public.start_skriveokt() from anon;
grant execute on function public.start_skriveokt() to authenticated;

revoke all on function public.hent_skriveokt(uuid) from public;
revoke all on function public.hent_skriveokt(uuid) from anon;
grant execute on function public.hent_skriveokt(uuid) to authenticated;

revoke all on function public.lagre_skriftlig_vurdering(uuid, uuid, uuid, text, jsonb) from public;
revoke all on function public.lagre_skriftlig_vurdering(uuid, uuid, uuid, text, jsonb) from anon;
revoke all on function public.lagre_skriftlig_vurdering(uuid, uuid, uuid, text, jsonb) from authenticated;
grant execute on function public.lagre_skriftlig_vurdering(uuid, uuid, uuid, text, jsonb) to service_role;

insert into public.oppgaver (
  id, type, ferdighet, "nivå", tema, kilde, status,
  kvalitetssjekket, innhold
) values (
  '11111111-1111-4111-8111-111111111701',
  'fritekst', 'skriving', 'A2', 'jobb', 'autentisk', 'publisert', true,
  $json${
    "tittel": "Sms til en kollega",
    "tekst": "Skriv en kort sms til en kollega. Si at du blir sen til møtet i dag, og si når du kommer.",
    "oppgavetype": "kort_melding",
    "nivagruppe": "A1-A2",
    "min_ord": 0
  }$json$::jsonb
);
