-- ============================================================
-- Fase 4: første lytteøkt (pastand_korrekt)
-- ============================================================
-- Samme svarform som lesing. Lydfil og transkripsjon ligger på raden.
-- Fasit sendes først etter svar. Se kontrakten i ROADMAP.md.
-- En økt har inntil 18 oppgaver. Færre når banken er mindre.

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

create or replace function public.hent_lytteokt(p_okt_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_okt public.okt_tilstand%rowtype;
  v_oppgaver jsonb;
begin
  if v_uid is null then
    raise exception 'ikke_innlogget' using errcode = 'P0001';
  end if;

  select * into v_okt
  from public.okt_tilstand
  where id = p_okt_id
    and bruker_id = v_uid
    and ferdighet = 'lytting';

  if not found then
    raise exception 'okt_ikke_funnet' using errcode = 'P0001';
  end if;

  select coalesce(jsonb_agg(rad.oppgave order by rad.rekkefolge), '[]'::jsonb)
    into v_oppgaver
  from (
    select
      oo.rekkefolge,
      jsonb_build_object(
        'type', 'pastand_korrekt',
        'id', o.id,
        'rekkefolge', oo.rekkefolge,
        'tittel', o.innhold->>'tittel',
        'tekst', o.innhold->>'tekst',
        'lyd_url', o.lyd_url,
        'transkripsjon', o.transkripsjon,
        'pastander', (
          select coalesce(jsonb_agg(
            jsonb_build_object('id', p.verdi->>'id', 'tekst', p.verdi->>'tekst')
            order by p.ord
          ), '[]'::jsonb)
          from jsonb_array_elements(o.innhold->'pastander')
            with ordinality as p(verdi, ord)
        ),
        'svar', svar.svar,
        'besvart', svar.besvart,
        'fasit', case when svar.besvart then (
          select coalesce(jsonb_agg(
            jsonb_build_object(
              'id', p.verdi->>'id',
              'korrekt', (p.verdi->>'korrekt')::boolean
            )
            order by p.ord
          ), '[]'::jsonb)
          from jsonb_array_elements(o.innhold->'pastander')
            with ordinality as p(verdi, ord)
        ) else null end
      ) as oppgave
    from public.okt_oppgaver oo
    join public.oppgaver o on o.id = oo.oppgave_id
    cross join lateral (
      select
        exists (
          select 1
          from public.bruker_oppgave_historikk h
          where h.bruker_id = v_uid
            and h.oppgave_id = o.id
        ) as besvart,
        (
          select s.svar_tekst::jsonb
          from public.bruker_svar s
          where s.okt_id = v_okt.id
            and s.oppgave_id = o.id
            and s.bruker_id = v_uid
          order by s.innsendt_dato desc
          limit 1
        ) as svar
    ) svar
    where oo.okt_id = v_okt.id
      and o.ferdighet = 'lytting'
      and o.type = 'pastand_korrekt'
  ) rad;

  return jsonb_build_object(
    'id', v_okt.id,
    'status', v_okt.status,
    'siste_posisjon', v_okt.siste_posisjon,
    'oppgaver', v_oppgaver
  );
end;
$$;

revoke all on function public.start_lytteokt() from public;
revoke all on function public.start_lytteokt() from anon;
grant execute on function public.start_lytteokt() to authenticated;

revoke all on function public.hent_lytteokt(uuid) from public;
revoke all on function public.hent_lytteokt(uuid) from anon;
grant execute on function public.hent_lytteokt(uuid) to authenticated;

insert into public.oppgaver (
  id, type, ferdighet, "nivå", tema, kilde, status,
  kvalitetssjekket, innhold, lyd_url, transkripsjon, opprettet_dato
) values
(
  '11111111-1111-4111-8111-111111111601',
  'pastand_korrekt', 'lytting', 'A2', 'hverdag', 'autentisk', 'publisert', true,
  $json${
    "tittel": "Bussen til jobb",
    "tekst": "Anna tar buss nummer trettien til jobb. Bussen går klokka sju førti.",
    "pastander": [
      {"id": "lyd-buss-1", "tekst": "Anna kjører bil til jobb.", "korrekt": false},
      {"id": "lyd-buss-2", "tekst": "Bussen går klokka sju førti.", "korrekt": true}
    ]
  }$json$::jsonb,
  '/lyd/buss.mp3',
  'Anna tar buss nummer trettien til jobb. Bussen går klokka sju førti.',
  '2026-10-04 12:00:00+00'
),
(
  '11111111-1111-4111-8111-111111111602',
  'pastand_korrekt', 'lytting', 'A2', 'hverdag', 'autentisk', 'publisert', true,
  $json${
    "tittel": "På butikken",
    "tekst": "Omar kjøper brød og melk. Butikken stenger klokka tjueen.",
    "pastander": [
      {"id": "lyd-butikk-1", "tekst": "Omar kjøper brød og melk.", "korrekt": true},
      {"id": "lyd-butikk-2", "tekst": "Butikken stenger klokka atten.", "korrekt": false}
    ]
  }$json$::jsonb,
  '/lyd/butikk.mp3',
  'Omar kjøper brød og melk. Butikken stenger klokka tjueen.',
  '2026-10-04 12:01:00+00'
),
(
  '11111111-1111-4111-8111-111111111603',
  'pastand_korrekt', 'lytting', 'A2', 'hverdag', 'autentisk', 'publisert', true,
  $json${
    "tittel": "Regn i dag",
    "tekst": "Det regner i Oslo i dag. Kari tar med paraply.",
    "pastander": [
      {"id": "lyd-regn-1", "tekst": "Det er sol i Oslo i dag.", "korrekt": false},
      {"id": "lyd-regn-2", "tekst": "Kari tar med paraply.", "korrekt": true}
    ]
  }$json$::jsonb,
  '/lyd/regn.mp3',
  'Det regner i Oslo i dag. Kari tar med paraply.',
  '2026-10-04 12:02:00+00'
),
(
  '11111111-1111-4111-8111-111111111604',
  'pastand_korrekt', 'lytting', 'A2', 'hverdag', 'autentisk', 'publisert', true,
  $json${
    "tittel": "Norskkurs",
    "tekst": "Lina går på norskkurs på tirsdag. Læreren heter Per.",
    "pastander": [
      {"id": "lyd-kurs-1", "tekst": "Lina går på kurs på tirsdag.", "korrekt": true},
      {"id": "lyd-kurs-2", "tekst": "Læreren heter Kari.", "korrekt": false}
    ]
  }$json$::jsonb,
  '/lyd/kurs.mp3',
  'Lina går på norskkurs på tirsdag. Læreren heter Per.',
  '2026-10-04 12:03:00+00'
)
on conflict (id) do nothing;
