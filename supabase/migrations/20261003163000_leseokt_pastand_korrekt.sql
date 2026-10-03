-- ============================================================
-- Fase 1: første leseøkt (pastand_korrekt)
-- ============================================================
-- Øktgrense, fasit og historikk ligger i disse funksjonene.
-- Nettleseren kan ikke lese oppgaver.innhold (der korrekt ligger),
-- opprette økter, skrive svar eller skrive historikk direkte.
-- Koden spør fortsatt «har bruker rettighet X» via plan_rettigheter.
-- Se kontrakten i ROADMAP.md.

-- ------------------------------------------------------------
-- Profil opprettes sammen med brukeren
-- ------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.brukerprofil (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public;
revoke all on function public.handle_new_user() from anon;
revoke all on function public.handle_new_user() from authenticated;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

insert into public.brukerprofil (id)
select id from auth.users
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- RLS: elev leser egen økt, men skriver den ikke
-- ------------------------------------------------------------

drop policy if exists "Bruker ser og oppdaterer egne økter" on public.okt_tilstand;

create policy "Bruker ser egne økter"
  on public.okt_tilstand for select
  using (auth.uid() = bruker_id);

drop policy if exists "Publiserte oppgaver er lesbare for innloggede brukere"
  on public.oppgaver;

drop policy if exists "Bruker ser og lagrer egne svar" on public.bruker_svar;

create policy "Bruker ser egne svar"
  on public.bruker_svar for select
  using (auth.uid() = bruker_id);

-- ------------------------------------------------------------
-- Start leseøkt
-- Fortsetter en pågående leseøkt selv om grensen er nådd.
-- Nye økter stoppes når fullførte økter har nådd okter_grense.
-- ------------------------------------------------------------

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

  -- Inntil 2 oppgaver i fase 1, så to hele økter får plass i seed-settet.
  for v_oppgave in
    select o.id
    from public.oppgaver o
    where o.status = 'publisert'
      and o.type = 'pastand_korrekt'
      and o.ferdighet = 'lesing'
      and not exists (
        select 1
        from public.bruker_oppgave_historikk h
        where h.bruker_id = v_uid
          and h.oppgave_id = o.id
      )
    order by o.ganger_servert, o.opprettet_dato
    limit 2
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

-- ------------------------------------------------------------
-- Hent økt uten fasit før oppgaven er besvart
-- ------------------------------------------------------------

create or replace function public.hent_leseokt(p_okt_id uuid)
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
    and ferdighet = 'lesing';

  if not found then
    raise exception 'okt_ikke_funnet' using errcode = 'P0001';
  end if;

  select coalesce(jsonb_agg(rad.oppgave order by rad.rekkefolge), '[]'::jsonb)
    into v_oppgaver
  from (
    select
      oo.rekkefolge,
      jsonb_build_object(
        'id', o.id,
        'rekkefolge', oo.rekkefolge,
        'tittel', o.innhold->>'tittel',
        'tekst', o.innhold->>'tekst',
        'pastander', (
          select coalesce(jsonb_agg(
            jsonb_build_object(
              'id', p.verdi->>'id',
              'tekst', p.verdi->>'tekst'
            )
            order by p.ord
          ), '[]'::jsonb)
          from jsonb_array_elements(o.innhold->'pastander')
            with ordinality as p(verdi, ord)
        ),
        'svar', (
          select s.svar_tekst::jsonb
          from public.bruker_svar s
          where s.okt_id = v_okt.id
            and s.oppgave_id = o.id
            and s.bruker_id = v_uid
          order by s.innsendt_dato desc
          limit 1
        ),
        'besvart', exists (
          select 1
          from public.bruker_oppgave_historikk h
          where h.bruker_id = v_uid
            and h.oppgave_id = o.id
        ),
        'fasit', case
          when exists (
            select 1
            from public.bruker_oppgave_historikk h
            where h.bruker_id = v_uid
              and h.oppgave_id = o.id
          ) then (
            select coalesce(jsonb_agg(
              jsonb_build_object(
                'id', p.verdi->>'id',
                'korrekt', (p.verdi->>'korrekt')::boolean
              )
              order by p.ord
            ), '[]'::jsonb)
            from jsonb_array_elements(o.innhold->'pastander')
              with ordinality as p(verdi, ord)
          )
          else null
        end
      ) as oppgave
    from public.okt_oppgaver oo
    join public.oppgaver o on o.id = oo.oppgave_id
    where oo.okt_id = v_okt.id
  ) rad;

  return jsonb_build_object(
    'id', v_okt.id,
    'status', v_okt.status,
    'siste_posisjon', v_okt.siste_posisjon,
    'oppgaver', v_oppgaver
  );
end;
$$;

-- ------------------------------------------------------------
-- Lagre svar. Autolagring flytter ikke posisjon.
-- Besvarelse fryser svaret, skriver historikk og øker telleren.
-- ------------------------------------------------------------

create or replace function public.lagre_svar(
  p_okt_id uuid,
  p_oppgave_id uuid,
  p_svar_tekst text,
  p_besvart boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_status text;
  v_innhold jsonb;
  v_svar jsonb;
  v_pastand jsonb;
  v_valg jsonb;
  v_rekkefolge int;
  v_treff bigint;
begin
  if v_uid is null then
    raise exception 'ikke_innlogget' using errcode = 'P0001';
  end if;

  if p_besvart is null then
    raise exception 'ugyldig_svar' using errcode = 'P0001';
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

  if not exists (
    select 1
    from public.okt_oppgaver
    where okt_id = p_okt_id
      and oppgave_id = p_oppgave_id
  ) then
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
    return;
  end if;

  if p_svar_tekst is null or length(btrim(p_svar_tekst)) = 0 then
    raise exception 'ugyldig_svar' using errcode = 'P0001';
  end if;

  begin
    v_svar := p_svar_tekst::jsonb;
  exception
    when others then
      raise exception 'ugyldig_svar' using errcode = 'P0001';
  end;

  if v_svar is null or jsonb_typeof(v_svar->'valg') <> 'array' then
    raise exception 'ugyldig_svar' using errcode = 'P0001';
  end if;

  select count(*) into v_treff from jsonb_array_elements(v_svar->'valg');
  if v_treff <> (
    select count(distinct elem->>'id')
    from jsonb_array_elements(v_svar->'valg') as t(elem)
  ) then
    raise exception 'ugyldig_svar' using errcode = 'P0001';
  end if;

  select innhold into v_innhold
  from public.oppgaver
  where id = p_oppgave_id;

  for v_valg in
    select elem from jsonb_array_elements(v_svar->'valg') as t(elem)
  loop
    if v_valg->>'id' is null or jsonb_typeof(v_valg->'svar') <> 'boolean' then
      raise exception 'ugyldig_svar' using errcode = 'P0001';
    end if;

    if not exists (
      select 1
      from jsonb_array_elements(v_innhold->'pastander') as p(pastand)
      where p.pastand->>'id' = v_valg->>'id'
    ) then
      raise exception 'ugyldig_svar' using errcode = 'P0001';
    end if;
  end loop;

  if p_besvart then
    for v_pastand in
      select elem from jsonb_array_elements(v_innhold->'pastander') as t(elem)
    loop
      if (
        select count(*)
        from jsonb_array_elements(v_svar->'valg') as v(valg)
        where v.valg->>'id' = v_pastand->>'id'
          and jsonb_typeof(v.valg->'svar') = 'boolean'
      ) <> 1 then
        raise exception 'ugyldig_svar' using errcode = 'P0001';
      end if;
    end loop;
  end if;

  delete from public.bruker_svar
  where bruker_id = v_uid
    and okt_id = p_okt_id
    and oppgave_id = p_oppgave_id;

  insert into public.bruker_svar (bruker_id, oppgave_id, okt_id, svar_tekst)
  values (v_uid, p_oppgave_id, p_okt_id, p_svar_tekst);

  if p_besvart then
    insert into public.bruker_oppgave_historikk (bruker_id, oppgave_id)
    values (v_uid, p_oppgave_id);

    update public.oppgaver
    set ganger_servert = ganger_servert + 1
    where id = p_oppgave_id;

    select rekkefolge into v_rekkefolge
    from public.okt_oppgaver
    where okt_id = p_okt_id
      and oppgave_id = p_oppgave_id;

    update public.okt_tilstand
    set siste_posisjon = v_rekkefolge,
        sist_lagret = now()
    where id = p_okt_id;
  else
    update public.okt_tilstand
    set sist_lagret = now()
    where id = p_okt_id;
  end if;
end;
$$;

-- ------------------------------------------------------------
-- Avslutt økten når hver frosne oppgave er besvart
-- ------------------------------------------------------------

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

-- ------------------------------------------------------------
-- Poeng: antall påstander der svar er lik korrekt
-- ------------------------------------------------------------

create or replace function public.poengsum_okt(p_okt_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_riktige bigint;
  v_mulige bigint;
begin
  if v_uid is null then
    raise exception 'ikke_innlogget' using errcode = 'P0001';
  end if;

  if not exists (
    select 1
    from public.okt_tilstand
    where id = p_okt_id
      and bruker_id = v_uid
  ) then
    raise exception 'okt_ikke_funnet' using errcode = 'P0001';
  end if;

  select coalesce(sum(jsonb_array_length(o.innhold->'pastander')), 0)
    into v_mulige
  from public.okt_oppgaver oo
  join public.oppgaver o on o.id = oo.oppgave_id
  where oo.okt_id = p_okt_id;

  select count(*) into v_riktige
  from (
    select distinct on (s.oppgave_id)
      s.oppgave_id,
      s.svar_tekst::jsonb as svar
    from public.bruker_svar s
    join public.bruker_oppgave_historikk h
      on h.bruker_id = s.bruker_id
     and h.oppgave_id = s.oppgave_id
    where s.okt_id = p_okt_id
      and s.bruker_id = v_uid
    order by s.oppgave_id, s.innsendt_dato desc
  ) besvart
  join public.oppgaver o on o.id = besvart.oppgave_id
  cross join lateral jsonb_array_elements(o.innhold->'pastander') as p(pastand)
  join lateral jsonb_array_elements(besvart.svar->'valg') as v(valg)
    on v.valg->>'id' = p.pastand->>'id'
  where (v.valg->>'svar')::boolean = (p.pastand->>'korrekt')::boolean;

  return jsonb_build_object(
    'riktige', v_riktige,
    'mulige', v_mulige
  );
end;
$$;

revoke all on function public.start_leseokt() from public;
revoke all on function public.start_leseokt() from anon;
grant execute on function public.start_leseokt() to authenticated;

revoke all on function public.hent_leseokt(uuid) from public;
revoke all on function public.hent_leseokt(uuid) from anon;
grant execute on function public.hent_leseokt(uuid) to authenticated;

revoke all on function public.lagre_svar(uuid, uuid, text, boolean) from public;
revoke all on function public.lagre_svar(uuid, uuid, text, boolean) from anon;
grant execute on function public.lagre_svar(uuid, uuid, text, boolean) to authenticated;

revoke all on function public.fullfor_okt(uuid) from public;
revoke all on function public.fullfor_okt(uuid) from anon;
grant execute on function public.fullfor_okt(uuid) to authenticated;

revoke all on function public.poengsum_okt(uuid) from public;
revoke all on function public.poengsum_okt(uuid) from anon;
grant execute on function public.poengsum_okt(uuid) to authenticated;

-- ------------------------------------------------------------
-- Håndskrevet A2-lesesett. Fire oppgaver gir to hele økter.
-- ------------------------------------------------------------

insert into public.oppgaver (
  id, type, ferdighet, "nivå", tema, kilde, status,
  kvalitetssjekket, innhold, opprettet_dato
) values
(
  '11111111-1111-4111-8111-111111111101',
  'pastand_korrekt',
  'lesing',
  'A2',
  'hverdag',
  'autentisk',
  'publisert',
  true,
  $json${
    "tittel": "Bussen til jobb",
    "tekst": "Anna tar buss nummer 31 til jobb. Bussen går klokka 07.40. Hun står på holdeplassen fem minutter før.",
    "pastander": [
      {"id": "buss-1", "tekst": "Anna kjører bil til jobb.", "korrekt": false},
      {"id": "buss-2", "tekst": "Bussen går klokka 07.40.", "korrekt": true}
    ]
  }$json$::jsonb,
  '2026-10-03 10:00:00+00'
),
(
  '11111111-1111-4111-8111-111111111102',
  'pastand_korrekt',
  'lesing',
  'A2',
  'hverdag',
  'autentisk',
  'publisert',
  true,
  $json${
    "tittel": "På butikken",
    "tekst": "Omar kjøper brød og melk. Butikken stenger klokka 21. Han betaler med kort.",
    "pastander": [
      {"id": "butikk-1", "tekst": "Omar kjøper brød og melk.", "korrekt": true},
      {"id": "butikk-2", "tekst": "Butikken stenger klokka 18.", "korrekt": false}
    ]
  }$json$::jsonb,
  '2026-10-03 10:01:00+00'
),
(
  '11111111-1111-4111-8111-111111111103',
  'pastand_korrekt',
  'lesing',
  'A2',
  'hverdag',
  'autentisk',
  'publisert',
  true,
  $json${
    "tittel": "Regn i dag",
    "tekst": "Det regner i Oslo i dag. Kari tar med paraply. Hun møter en venn på kafé klokka 12.",
    "pastander": [
      {"id": "regn-1", "tekst": "Det er sol i Oslo i dag.", "korrekt": false},
      {"id": "regn-2", "tekst": "Kari møter en venn.", "korrekt": true}
    ]
  }$json$::jsonb,
  '2026-10-03 10:02:00+00'
),
(
  '11111111-1111-4111-8111-111111111104',
  'pastand_korrekt',
  'lesing',
  'A2',
  'hverdag',
  'autentisk',
  'publisert',
  true,
  $json${
    "tittel": "Norskkurs",
    "tekst": "Lina går på norskkurs to kvelder i uken. Kurset er tirsdag og torsdag. Læreren heter Per.",
    "pastander": [
      {"id": "kurs-1", "tekst": "Lina går på kurs to kvelder i uken.", "korrekt": true},
      {"id": "kurs-2", "tekst": "Kurset er mandag og onsdag.", "korrekt": false}
    ]
  }$json$::jsonb,
  '2026-10-03 10:03:00+00'
)
on conflict (id) do nothing;
