-- ============================================================
-- Fase 8: muntlig bildeoppgave
-- ============================================================
-- Én håndskrevet oppgave. Eleven ser bildet og forteller.
-- Promptfilen endres ikke. Se ROADMAP.md.

insert into public.bilder (
  id, url, beskrivelse, tema, kilde, status, kreditering_pakrevd
) values (
  '22222222-2222-4222-8222-222222222801',
  '/bilder/kjokken.svg',
  'En person sitter på en stol ved et bord. Det står en kopp på bordet. Det er et vindu bak personen.',
  'hverdag',
  'opplastet',
  'godkjent',
  false
);

insert into public.oppgaver (
  id, type, ferdighet, "nivå", tema, kilde, status,
  kvalitetssjekket, bilde_id, innhold
) values (
  '11111111-1111-4111-8111-111111111802',
  'muntlig_opptak', 'muntlig', 'A2', 'hverdag', 'autentisk', 'publisert', true,
  '22222222-2222-4222-8222-222222222801',
  $json${
    "tittel": "Beskriv bildet",
    "tekst": "Se på bildet. Fortell hva du ser.",
    "oppgavetype": "individuell_beskrive_bilde",
    "nivagruppe": "A1-A2"
  }$json$::jsonb
);

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

  select o.id into v_oppgave
  from public.oppgaver o
  where o.status = 'publisert'
    and o.ferdighet = 'muntlig'
    and o.type = 'muntlig_opptak'
    and o.innhold->>'nivagruppe' in ('A1-A2', 'A2-B1', 'B1-B2')
    and nullif(btrim(o.innhold->>'tittel'), '') is not null
    and nullif(btrim(o.innhold->>'tekst'), '') is not null
    and (
      (
        o.innhold->>'oppgavetype' = 'individuell_fortelle'
        and o.bilde_id is null
      )
      or (
        o.innhold->>'oppgavetype' = 'individuell_beskrive_bilde'
        and exists (
          select 1
          from public.bilder b
          where b.id = o.bilde_id
            and b.status = 'godkjent'
            and b.url ~ '^/bilder/[a-z0-9-]+\.(svg|png|webp)$'
            and nullif(btrim(b.beskrivelse), '') is not null
        )
      )
    )
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
  values (v_uid, 'muntlig')
  returning id into v_okt;

  insert into public.okt_oppgaver (okt_id, oppgave_id, rekkefolge)
  values (v_okt, v_oppgave, 1);

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
    'bilde', case
      when b.id is null then null
      else jsonb_build_object('url', b.url, 'beskrivelse', b.beskrivelse)
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
  into v_oppgave
  from public.okt_oppgaver oo
  join public.oppgaver o on o.id = oo.oppgave_id
  left join public.bilder b
    on b.id = o.bilde_id
   and b.status = 'godkjent'
   and b.url ~ '^/bilder/[a-z0-9-]+\.(svg|png|webp)$'
   and nullif(btrim(b.beskrivelse), '') is not null
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
    'bilde', case
      when b.id is null then null
      else jsonb_build_object('url', b.url, 'beskrivelse', b.beskrivelse)
    end,
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
  left join public.bilder b
    on b.id = o.bilde_id
   and b.status = 'godkjent'
   and b.url ~ '^/bilder/[a-z0-9-]+\.(svg|png|webp)$'
   and nullif(btrim(b.beskrivelse), '') is not null
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

do $$
begin
  if not exists (
    select 1
    from public.oppgaver o
    join public.bilder b on b.id = o.bilde_id
    where o.id = '11111111-1111-4111-8111-111111111802'
      and o.status = 'publisert'
      and o.innhold->>'oppgavetype' = 'individuell_beskrive_bilde'
      and b.status = 'godkjent'
      and b.url = '/bilder/kjokken.svg'
  ) then
    raise exception 'muntlig_bilde_mangler';
  end if;
end;
$$;

notify pgrst, 'reload schema';
