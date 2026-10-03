-- ============================================================
-- Fase 2: flere lesetyper i samme økt
-- ============================================================
-- En økt har inntil 15 oppgaver og høyst 6 av samme type.
-- Typene går på omgang. Fasit forblir i funksjonene.
-- Se kontraktene i ROADMAP.md.

create or replace function public.normaliser_ord(p_tekst text)
returns text
language sql
immutable
as $$
  select lower(btrim(regexp_replace(coalesce(p_tekst, ''), '\s+', ' ', 'g')));
$$;

revoke all on function public.normaliser_ord(text) from public;
revoke all on function public.normaliser_ord(text) from anon;
revoke all on function public.normaliser_ord(text) from authenticated;

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
      case o.type
        when 'pastand_korrekt' then jsonb_build_object(
          'type', 'pastand_korrekt',
          'id', o.id,
          'rekkefolge', oo.rekkefolge,
          'tittel', o.innhold->>'tittel',
          'tekst', o.innhold->>'tekst',
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
        )
        when 'fyll_inn' then jsonb_build_object(
          'type', 'fyll_inn',
          'id', o.id,
          'rekkefolge', oo.rekkefolge,
          'tittel', o.innhold->>'tittel',
          'tekst', o.innhold->>'tekst',
          'deler', (
            select coalesce(jsonb_agg(
              case
                when d.verdi->>'type' = 'hull' then jsonb_build_object(
                  'type', 'hull',
                  'id', d.verdi->>'id'
                )
                else jsonb_build_object(
                  'type', 'tekst',
                  'tekst', d.verdi->>'tekst'
                )
              end
              order by d.ord
            ), '[]'::jsonb)
            from jsonb_array_elements(o.innhold->'deler')
              with ordinality as d(verdi, ord)
          ),
          'svar', svar.svar,
          'besvart', svar.besvart,
          'fasit', case when svar.besvart then o.innhold->'fasit' else null end
        )
        when 'synonym' then jsonb_build_object(
          'type', 'synonym',
          'id', o.id,
          'rekkefolge', oo.rekkefolge,
          'tittel', o.innhold->>'tittel',
          'tekst', o.innhold->>'setning',
          'ord', o.innhold->>'ord',
          'alternativer', o.innhold->'alternativer',
          'svar', svar.svar,
          'besvart', svar.besvart,
          'fasit', case when svar.besvart then jsonb_build_object(
            'korrekt', o.innhold->>'korrekt'
          ) else null end
        )
        when 'antonym' then jsonb_build_object(
          'type', 'antonym',
          'id', o.id,
          'rekkefolge', oo.rekkefolge,
          'tittel', o.innhold->>'tittel',
          'tekst', o.innhold->>'setning',
          'ord', o.innhold->>'ord',
          'alternativer', o.innhold->'alternativer',
          'svar', svar.svar,
          'besvart', svar.besvart,
          'fasit', case when svar.besvart then jsonb_build_object(
            'korrekt', o.innhold->>'korrekt'
          ) else null end
        )
        when 'rekkefolge' then jsonb_build_object(
          'type', 'rekkefolge',
          'id', o.id,
          'rekkefolge', oo.rekkefolge,
          'tittel', o.innhold->>'tittel',
          'tekst', 'Sett setningene i riktig rekkefølge.',
          'ledd', (
            select coalesce(jsonb_agg(
              jsonb_build_object('id', l.ledd->>'id', 'tekst', l.ledd->>'tekst')
              order by v.ord
            ), '[]'::jsonb)
            from jsonb_array_elements_text(o.innhold->'visning')
              with ordinality as v(ledd_id, ord)
            join lateral (
              select elem as ledd
              from jsonb_array_elements(o.innhold->'ledd') elem
              where elem->>'id' = v.ledd_id
            ) l on true
          ),
          'svar', svar.svar,
          'besvart', svar.besvart,
          'fasit', case when svar.besvart then jsonb_build_object(
            'riktig', o.innhold->'riktig'
          ) else null end
        )
        else jsonb_build_object(
          'type', o.type,
          'id', o.id,
          'rekkefolge', oo.rekkefolge,
          'tittel', coalesce(o.innhold->>'tittel', 'Oppgave'),
          'tekst', '',
          'besvart', svar.besvart,
          'svar', null,
          'fasit', null
        )
      end as oppgave
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
  ) rad;

  return jsonb_build_object(
    'id', v_okt.id,
    'status', v_okt.status,
    'siste_posisjon', v_okt.siste_posisjon,
    'oppgaver', v_oppgaver
  );
end;
$$;

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
  v_type text;
  v_innhold jsonb;
  v_svar jsonb;
  v_element jsonb;
  v_rekkefolge int;
  v_antall bigint;
  v_unike bigint;
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

  select o.type, o.innhold
    into v_type, v_innhold
  from public.oppgaver o
  where o.id = p_oppgave_id;

  if v_type = 'pastand_korrekt' then
    if jsonb_typeof(v_svar->'valg') <> 'array' then
      raise exception 'ugyldig_svar' using errcode = 'P0001';
    end if;

    select count(*), count(distinct elem->>'id')
      into v_antall, v_unike
    from jsonb_array_elements(v_svar->'valg') as t(elem);

    if v_antall <> v_unike then
      raise exception 'ugyldig_svar' using errcode = 'P0001';
    end if;

    for v_element in
      select elem from jsonb_array_elements(v_svar->'valg') as t(elem)
    loop
      if v_element->>'id' is null or jsonb_typeof(v_element->'svar') <> 'boolean' then
        raise exception 'ugyldig_svar' using errcode = 'P0001';
      end if;
      if not exists (
        select 1
        from jsonb_array_elements(v_innhold->'pastander') as p(pastand)
        where p.pastand->>'id' = v_element->>'id'
      ) then
        raise exception 'ugyldig_svar' using errcode = 'P0001';
      end if;
    end loop;

    if p_besvart then
      for v_element in
        select elem from jsonb_array_elements(v_innhold->'pastander') as t(elem)
      loop
        if (
          select count(*)
          from jsonb_array_elements(v_svar->'valg') as v(valg)
          where v.valg->>'id' = v_element->>'id'
            and jsonb_typeof(v.valg->'svar') = 'boolean'
        ) <> 1 then
          raise exception 'ugyldig_svar' using errcode = 'P0001';
        end if;
      end loop;
    end if;

  elsif v_type = 'fyll_inn' then
    if jsonb_typeof(v_svar->'hull') <> 'array' then
      raise exception 'ugyldig_svar' using errcode = 'P0001';
    end if;

    select count(*), count(distinct elem->>'id')
      into v_antall, v_unike
    from jsonb_array_elements(v_svar->'hull') as t(elem);

    if v_antall <> v_unike then
      raise exception 'ugyldig_svar' using errcode = 'P0001';
    end if;

    for v_element in
      select elem from jsonb_array_elements(v_svar->'hull') as t(elem)
    loop
      if v_element->>'id' is null or jsonb_typeof(v_element->'svar') <> 'string' then
        raise exception 'ugyldig_svar' using errcode = 'P0001';
      end if;
      if not exists (
        select 1
        from jsonb_array_elements(v_innhold->'fasit') as f(fasit)
        where f.fasit->>'id' = v_element->>'id'
      ) then
        raise exception 'ugyldig_svar' using errcode = 'P0001';
      end if;
    end loop;

    if p_besvart then
      for v_element in
        select elem from jsonb_array_elements(v_innhold->'fasit') as t(elem)
      loop
        if (
          select count(*)
          from jsonb_array_elements(v_svar->'hull') as h(hull)
          where h.hull->>'id' = v_element->>'id'
            and length(btrim(h.hull->>'svar')) > 0
        ) <> 1 then
          raise exception 'ugyldig_svar' using errcode = 'P0001';
        end if;
      end loop;
    end if;

  elsif v_type in ('synonym', 'antonym') then
    if jsonb_typeof(v_svar->'valgId') <> 'string' then
      raise exception 'ugyldig_svar' using errcode = 'P0001';
    end if;
    if not exists (
      select 1
      from jsonb_array_elements(v_innhold->'alternativer') as a(alt)
      where a.alt->>'id' = v_svar->>'valgId'
    ) then
      raise exception 'ugyldig_svar' using errcode = 'P0001';
    end if;

  elsif v_type = 'rekkefolge' then
    if jsonb_typeof(v_svar->'rekkefolge') <> 'array' then
      raise exception 'ugyldig_svar' using errcode = 'P0001';
    end if;

    select count(*), count(distinct elem)
      into v_antall, v_unike
    from jsonb_array_elements_text(v_svar->'rekkefolge') as t(elem);

    if v_antall <> v_unike then
      raise exception 'ugyldig_svar' using errcode = 'P0001';
    end if;

    if exists (
      select 1
      from jsonb_array_elements_text(v_svar->'rekkefolge') as r(ledd_id)
      where not exists (
        select 1
        from jsonb_array_elements(v_innhold->'ledd') as l(ledd)
        where l.ledd->>'id' = r.ledd_id
      )
    ) then
      raise exception 'ugyldig_svar' using errcode = 'P0001';
    end if;

    if p_besvart and v_antall <> jsonb_array_length(v_innhold->'ledd') then
      raise exception 'ugyldig_svar' using errcode = 'P0001';
    end if;

  else
    raise exception 'ugyldig_svar' using errcode = 'P0001';
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

create or replace function public.poengsum_okt(p_okt_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_riktige bigint := 0;
  v_mulige bigint := 0;
  v_del bigint;
  r record;
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

  for r in
    select
      o.type,
      o.innhold,
      (
        select s.svar_tekst::jsonb
        from public.bruker_svar s
        join public.bruker_oppgave_historikk h
          on h.bruker_id = s.bruker_id
         and h.oppgave_id = s.oppgave_id
        where s.okt_id = p_okt_id
          and s.oppgave_id = o.id
          and s.bruker_id = v_uid
        order by s.innsendt_dato desc
        limit 1
      ) as svar
    from public.okt_oppgaver oo
    join public.oppgaver o on o.id = oo.oppgave_id
    where oo.okt_id = p_okt_id
  loop
    if r.type = 'pastand_korrekt' then
      v_mulige := v_mulige + coalesce(jsonb_array_length(r.innhold->'pastander'), 0);
      if r.svar is not null then
        select count(*) into v_del
        from jsonb_array_elements(r.innhold->'pastander') as p(pastand)
        join jsonb_array_elements(r.svar->'valg') as v(valg)
          on v.valg->>'id' = p.pastand->>'id'
        where (v.valg->>'svar')::boolean = (p.pastand->>'korrekt')::boolean;
        v_riktige := v_riktige + v_del;
      end if;

    elsif r.type = 'fyll_inn' then
      v_mulige := v_mulige + coalesce(jsonb_array_length(r.innhold->'fasit'), 0);
      if r.svar is not null then
        select count(*) into v_del
        from jsonb_array_elements(r.innhold->'fasit') as f(fasit)
        where exists (
          select 1
          from jsonb_array_elements(r.svar->'hull') as h(hull)
          cross join jsonb_array_elements_text(f.fasit->'ord') as o(ord)
          where h.hull->>'id' = f.fasit->>'id'
            and public.normaliser_ord(h.hull->>'svar') = public.normaliser_ord(o.ord)
        );
        v_riktige := v_riktige + v_del;
      end if;

    elsif r.type in ('synonym', 'antonym') then
      v_mulige := v_mulige + 1;
      if r.svar is not null and r.svar->>'valgId' = r.innhold->>'korrekt' then
        v_riktige := v_riktige + 1;
      end if;

    elsif r.type = 'rekkefolge' then
      v_mulige := v_mulige + 1;
      if r.svar is not null and r.svar->'rekkefolge' = r.innhold->'riktig' then
        v_riktige := v_riktige + 1;
      end if;
    end if;
  end loop;

  return jsonb_build_object(
    'riktige', v_riktige,
    'mulige', v_mulige
  );
end;
$$;

insert into public.oppgaver (
  id, type, ferdighet, "nivå", tema, kilde, status,
  kvalitetssjekket, innhold, opprettet_dato
) values
(
  '11111111-1111-4111-8111-111111111201',
  'fyll_inn', 'lesing', 'A2', 'hverdag', 'autentisk', 'publisert', true,
  $json${
    "tittel": "Om morgenen",
    "tekst": "Per liker varm drikke til frokost.",
    "deler": [
      {"type": "tekst", "tekst": "Jeg drikker "},
      {"type": "hull", "id": "drikke-1"},
      {"type": "tekst", "tekst": " om morgenen."}
    ],
    "fasit": [{"id": "drikke-1", "ord": ["kaffe"]}]
  }$json$::jsonb,
  '2026-10-03 11:00:00+00'
),
(
  '11111111-1111-4111-8111-111111111202',
  'fyll_inn', 'lesing', 'A2', 'hverdag', 'autentisk', 'publisert', true,
  $json${
    "tittel": "På kjøkkenet",
    "tekst": "Melk skal stå kaldt.",
    "deler": [
      {"type": "tekst", "tekst": "Melk står i "},
      {"type": "hull", "id": "kjol-1"},
      {"type": "tekst", "tekst": "."}
    ],
    "fasit": [{"id": "kjol-1", "ord": ["kjøleskapet"]}]
  }$json$::jsonb,
  '2026-10-03 11:01:00+00'
),
(
  '11111111-1111-4111-8111-111111111203',
  'fyll_inn', 'lesing', 'A2', 'hverdag', 'autentisk', 'publisert', true,
  $json${
    "tittel": "Været ute",
    "tekst": "Kari tar med paraply når hun går ut.",
    "deler": [
      {"type": "tekst", "tekst": "I dag er det "},
      {"type": "hull", "id": "vaer-1"},
      {"type": "tekst", "tekst": " ute."}
    ],
    "fasit": [{"id": "vaer-1", "ord": ["regn"]}]
  }$json$::jsonb,
  '2026-10-03 11:02:00+00'
),
(
  '11111111-1111-4111-8111-111111111204',
  'fyll_inn', 'lesing', 'A2', 'hverdag', 'autentisk', 'publisert', true,
  $json${
    "tittel": "Om kvelden",
    "tekst": "Lina lærer norsk to kvelder i uken.",
    "deler": [
      {"type": "tekst", "tekst": "Hun går på "},
      {"type": "hull", "id": "kveld-1"},
      {"type": "tekst", "tekst": " om kvelden."}
    ],
    "fasit": [{"id": "kveld-1", "ord": ["kurs"]}]
  }$json$::jsonb,
  '2026-10-03 11:03:00+00'
),
(
  '11111111-1111-4111-8111-111111111301',
  'synonym', 'lesing', 'A2', 'hverdag', 'autentisk', 'publisert', true,
  $json${
    "tittel": "Samme betydning",
    "ord": "glad",
    "setning": "Barnet er glad i dag.",
    "alternativer": [
      {"id": "glad-a", "tekst": "lykkelig"},
      {"id": "glad-b", "tekst": "trist"},
      {"id": "glad-c", "tekst": "sint"}
    ],
    "korrekt": "glad-a"
  }$json$::jsonb,
  '2026-10-03 11:10:00+00'
),
(
  '11111111-1111-4111-8111-111111111302',
  'synonym', 'lesing', 'A2', 'hverdag', 'autentisk', 'publisert', true,
  $json${
    "tittel": "Samme betydning",
    "ord": "begynne",
    "setning": "Vi begynner timen nå.",
    "alternativer": [
      {"id": "begynn-a", "tekst": "starte"},
      {"id": "begynn-b", "tekst": "slutte"},
      {"id": "begynn-c", "tekst": "sove"}
    ],
    "korrekt": "begynn-a"
  }$json$::jsonb,
  '2026-10-03 11:11:00+00'
),
(
  '11111111-1111-4111-8111-111111111303',
  'synonym', 'lesing', 'A2', 'hverdag', 'autentisk', 'publisert', true,
  $json${
    "tittel": "Samme betydning",
    "ord": "rask",
    "setning": "Bussen er rask i dag.",
    "alternativer": [
      {"id": "rask-a", "tekst": "fort"},
      {"id": "rask-b", "tekst": "sen"},
      {"id": "rask-c", "tekst": "dyr"}
    ],
    "korrekt": "rask-a"
  }$json$::jsonb,
  '2026-10-03 11:12:00+00'
),
(
  '11111111-1111-4111-8111-111111111304',
  'synonym', 'lesing', 'A2', 'hverdag', 'autentisk', 'publisert', true,
  $json${
    "tittel": "Samme betydning",
    "ord": "hus",
    "setning": "De bor i et hus.",
    "alternativer": [
      {"id": "hus-a", "tekst": "bolig"},
      {"id": "hus-b", "tekst": "bil"},
      {"id": "hus-c", "tekst": "vei"}
    ],
    "korrekt": "hus-a"
  }$json$::jsonb,
  '2026-10-03 11:13:00+00'
),
(
  '11111111-1111-4111-8111-111111111401',
  'antonym', 'lesing', 'A2', 'hverdag', 'autentisk', 'publisert', true,
  $json${
    "tittel": "Motsatt betydning",
    "ord": "varm",
    "setning": "Suppen er varm.",
    "alternativer": [
      {"id": "varm-a", "tekst": "kald"},
      {"id": "varm-b", "tekst": "søt"},
      {"id": "varm-c", "tekst": "ny"}
    ],
    "korrekt": "varm-a"
  }$json$::jsonb,
  '2026-10-03 11:20:00+00'
),
(
  '11111111-1111-4111-8111-111111111402',
  'antonym', 'lesing', 'A2', 'hverdag', 'autentisk', 'publisert', true,
  $json${
    "tittel": "Motsatt betydning",
    "ord": "åpen",
    "setning": "Butikken er åpen.",
    "alternativer": [
      {"id": "apen-a", "tekst": "stengt"},
      {"id": "apen-b", "tekst": "stor"},
      {"id": "apen-c", "tekst": "fin"}
    ],
    "korrekt": "apen-a"
  }$json$::jsonb,
  '2026-10-03 11:21:00+00'
),
(
  '11111111-1111-4111-8111-111111111403',
  'antonym', 'lesing', 'A2', 'hverdag', 'autentisk', 'publisert', true,
  $json${
    "tittel": "Motsatt betydning",
    "ord": "tidlig",
    "setning": "Bussen går tidlig.",
    "alternativer": [
      {"id": "tidlig-a", "tekst": "sent"},
      {"id": "tidlig-b", "tekst": "fort"},
      {"id": "tidlig-c", "tekst": "nå"}
    ],
    "korrekt": "tidlig-a"
  }$json$::jsonb,
  '2026-10-03 11:22:00+00'
),
(
  '11111111-1111-4111-8111-111111111404',
  'antonym', 'lesing', 'A2', 'hverdag', 'autentisk', 'publisert', true,
  $json${
    "tittel": "Motsatt betydning",
    "ord": "billig",
    "setning": "Billetten er billig.",
    "alternativer": [
      {"id": "billig-a", "tekst": "dyr"},
      {"id": "billig-b", "tekst": "lang"},
      {"id": "billig-c", "tekst": "ny"}
    ],
    "korrekt": "billig-a"
  }$json$::jsonb,
  '2026-10-03 11:23:00+00'
),
(
  '11111111-1111-4111-8111-111111111501',
  'rekkefolge', 'lesing', 'A2', 'hverdag', 'autentisk', 'publisert', true,
  $json${
    "tittel": "Morgenrutine",
    "ledd": [
      {"id": "m1", "tekst": "Først lager han kaffe."},
      {"id": "m2", "tekst": "Så spiser han brød."},
      {"id": "m3", "tekst": "Til slutt går han ut."}
    ],
    "visning": ["m3", "m1", "m2"],
    "riktig": ["m1", "m2", "m3"]
  }$json$::jsonb,
  '2026-10-03 11:30:00+00'
),
(
  '11111111-1111-4111-8111-111111111502',
  'rekkefolge', 'lesing', 'A2', 'hverdag', 'autentisk', 'publisert', true,
  $json${
    "tittel": "I butikken",
    "ledd": [
      {"id": "b1", "tekst": "Hun går inn i butikken."},
      {"id": "b2", "tekst": "Hun kjøper melk."},
      {"id": "b3", "tekst": "Hun betaler i kassen."}
    ],
    "visning": ["b2", "b3", "b1"],
    "riktig": ["b1", "b2", "b3"]
  }$json$::jsonb,
  '2026-10-03 11:31:00+00'
),
(
  '11111111-1111-4111-8111-111111111503',
  'rekkefolge', 'lesing', 'A2', 'hverdag', 'autentisk', 'publisert', true,
  $json${
    "tittel": "Med toget",
    "ledd": [
      {"id": "t1", "tekst": "De kjøper billett."},
      {"id": "t2", "tekst": "De setter seg på toget."},
      {"id": "t3", "tekst": "Toget kjører fra stasjonen."}
    ],
    "visning": ["t3", "t1", "t2"],
    "riktig": ["t1", "t2", "t3"]
  }$json$::jsonb,
  '2026-10-03 11:32:00+00'
),
(
  '11111111-1111-4111-8111-111111111504',
  'rekkefolge', 'lesing', 'A2', 'hverdag', 'autentisk', 'publisert', true,
  $json${
    "tittel": "På kurset",
    "ledd": [
      {"id": "k1", "tekst": "Lina kommer til klasserommet."},
      {"id": "k2", "tekst": "Hun hilser på læreren."},
      {"id": "k3", "tekst": "Hun åpner boka."}
    ],
    "visning": ["k2", "k3", "k1"],
    "riktig": ["k1", "k2", "k3"]
  }$json$::jsonb,
  '2026-10-03 11:33:00+00'
)
on conflict (id) do nothing;
