-- ============================================================
-- Fase 3: redaktør skriver leseoppgaver uten å åpne tabellen
-- ============================================================
-- Rollen er elev eller redaktor. Eleven kan ikke endre den.
-- Fasit blir værende i funksjonene. Ingen ny SELECT-policy
-- på oppgaver. Se beslutningen i ROADMAP.md.

alter table public.brukerprofil
  add column rolle text not null default 'elev'
  constraint brukerprofil_rolle_check check (rolle in ('elev', 'redaktor'));

create or replace function public.er_redaktor()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.brukerprofil
    where id = auth.uid()
      and rolle = 'redaktor'
  );
$$;

create or replace function public.krev_redaktor()
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'ikke_innlogget' using errcode = 'P0001';
  end if;

  if not public.er_redaktor() then
    raise exception 'ikke_redaktor' using errcode = 'P0001';
  end if;
end;
$$;

-- Rollen endres bare uten innlogget bruker, altså fra databasen.
create or replace function public.beskytt_brukerrolle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.rolle is distinct from old.rolle and auth.uid() is not null then
    raise exception 'ikke_redaktor' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists brukerprofil_beskytt_rolle on public.brukerprofil;

create trigger brukerprofil_beskytt_rolle
  before update on public.brukerprofil
  for each row execute function public.beskytt_brukerrolle();

-- Kontrollerer editorformen og setter visningen for rekkefølge.
create or replace function public.valider_lese_innhold(p_type text, p_innhold jsonb)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  v_hull text;
  v_ord text;
  v_riktig jsonb;
  v_visning jsonb;
begin
  if p_innhold is null or jsonb_typeof(p_innhold) <> 'object' then
    raise exception 'ugyldig_innhold' using errcode = 'P0001';
  end if;

  if p_type = 'pastand_korrekt' then
    if nullif(btrim(p_innhold->>'tittel'), '') is null
       or nullif(btrim(p_innhold->>'tekst'), '') is null
       or jsonb_typeof(p_innhold->'pastander') is distinct from 'array'
       or jsonb_array_length(p_innhold->'pastander') <> 2
    then
      raise exception 'ugyldig_innhold' using errcode = 'P0001';
    end if;

    if exists (
      select 1
      from jsonb_array_elements(p_innhold->'pastander') as p(pastand)
      where jsonb_typeof(p.pastand) is distinct from 'object'
         or nullif(btrim(p.pastand->>'id'), '') is null
         or nullif(btrim(p.pastand->>'tekst'), '') is null
         or jsonb_typeof(p.pastand->'korrekt') is distinct from 'boolean'
    ) then
      raise exception 'ugyldig_innhold' using errcode = 'P0001';
    end if;

    if (
      select count(distinct p.pastand->>'id')
      from jsonb_array_elements(p_innhold->'pastander') as p(pastand)
    ) <> 2 then
      raise exception 'ugyldig_innhold' using errcode = 'P0001';
    end if;

    return p_innhold;
  elsif p_type = 'fyll_inn' then
    if nullif(btrim(p_innhold->>'tittel'), '') is null
       or nullif(btrim(p_innhold->>'tekst'), '') is null
       or jsonb_typeof(p_innhold->'deler') is distinct from 'array'
       or jsonb_array_length(p_innhold->'deler') <> 3
       or jsonb_typeof(p_innhold->'fasit') is distinct from 'array'
       or jsonb_array_length(p_innhold->'fasit') <> 1
    then
      raise exception 'ugyldig_innhold' using errcode = 'P0001';
    end if;

    if p_innhold->'deler'->0->>'type' is distinct from 'tekst'
       or nullif(btrim(p_innhold->'deler'->0->>'tekst'), '') is null
       or p_innhold->'deler'->1->>'type' is distinct from 'hull'
       or nullif(btrim(p_innhold->'deler'->1->>'id'), '') is null
       or p_innhold->'deler'->2->>'type' is distinct from 'tekst'
       or nullif(btrim(p_innhold->'deler'->2->>'tekst'), '') is null
    then
      raise exception 'ugyldig_innhold' using errcode = 'P0001';
    end if;

    v_hull := btrim(p_innhold->'deler'->1->>'id');

    if jsonb_typeof(p_innhold->'fasit'->0->'ord') is distinct from 'array'
       or jsonb_array_length(p_innhold->'fasit'->0->'ord') <> 1
       or p_innhold->'fasit'->0->>'id' is distinct from v_hull
       or nullif(btrim(p_innhold->'fasit'->0->'ord'->>0), '') is null
    then
      raise exception 'ugyldig_innhold' using errcode = 'P0001';
    end if;

    v_ord := public.normaliser_ord(p_innhold->'fasit'->0->'ord'->>0);
    if v_ord = '' or strpos(public.normaliser_ord(v_hull), v_ord) > 0 then
      raise exception 'ugyldig_innhold' using errcode = 'P0001';
    end if;

    return p_innhold;
  elsif p_type in ('synonym', 'antonym') then
    if nullif(btrim(p_innhold->>'tittel'), '') is null
       or nullif(btrim(p_innhold->>'ord'), '') is null
       or nullif(btrim(p_innhold->>'setning'), '') is null
       or nullif(btrim(p_innhold->>'korrekt'), '') is null
       or jsonb_typeof(p_innhold->'alternativer') is distinct from 'array'
       or jsonb_array_length(p_innhold->'alternativer') <> 3
    then
      raise exception 'ugyldig_innhold' using errcode = 'P0001';
    end if;

    if exists (
      select 1
      from jsonb_array_elements(p_innhold->'alternativer') as a(alt)
      where jsonb_typeof(a.alt) is distinct from 'object'
         or nullif(btrim(a.alt->>'id'), '') is null
         or nullif(btrim(a.alt->>'tekst'), '') is null
    ) then
      raise exception 'ugyldig_innhold' using errcode = 'P0001';
    end if;

    if (
      select count(distinct a.alt->>'id')
      from jsonb_array_elements(p_innhold->'alternativer') as a(alt)
    ) <> 3 then
      raise exception 'ugyldig_innhold' using errcode = 'P0001';
    end if;

    if not exists (
      select 1
      from jsonb_array_elements(p_innhold->'alternativer') as a(alt)
      where a.alt->>'id' = p_innhold->>'korrekt'
    ) then
      raise exception 'ugyldig_innhold' using errcode = 'P0001';
    end if;

    return p_innhold;
  elsif p_type = 'rekkefolge' then
    if nullif(btrim(p_innhold->>'tittel'), '') is null
       or jsonb_typeof(p_innhold->'ledd') is distinct from 'array'
       or jsonb_array_length(p_innhold->'ledd') <> 3
    then
      raise exception 'ugyldig_innhold' using errcode = 'P0001';
    end if;

    if exists (
      select 1
      from jsonb_array_elements(p_innhold->'ledd') as l(ledd)
      where jsonb_typeof(l.ledd) is distinct from 'object'
         or nullif(btrim(l.ledd->>'id'), '') is null
         or nullif(btrim(l.ledd->>'tekst'), '') is null
    ) then
      raise exception 'ugyldig_innhold' using errcode = 'P0001';
    end if;

    if (
      select count(distinct l.ledd->>'id')
      from jsonb_array_elements(p_innhold->'ledd') as l(ledd)
    ) <> 3 then
      raise exception 'ugyldig_innhold' using errcode = 'P0001';
    end if;

    select jsonb_agg(l.ledd->>'id' order by l.ord)
      into v_riktig
    from jsonb_array_elements(p_innhold->'ledd') with ordinality as l(ledd, ord);

    select jsonb_agg(l.ledd->>'id' order by l.ord desc)
      into v_visning
    from jsonb_array_elements(p_innhold->'ledd') with ordinality as l(ledd, ord);

    return jsonb_set(
      jsonb_set(p_innhold, '{riktig}', v_riktig, true),
      '{visning}',
      v_visning,
      true
    );
  end if;

  raise exception 'ugyldig_innhold' using errcode = 'P0001';
end;
$$;

create or replace function public.redaktor_liste()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_rader jsonb;
begin
  perform public.krev_redaktor();

  select coalesce(
    jsonb_agg(rad.oppgave order by rad.opprettet_dato desc, rad.id),
    '[]'::jsonb
  )
    into v_rader
  from (
    select
      o.opprettet_dato,
      o.id,
      jsonb_build_object(
        'id', o.id,
        'type', o.type,
        'niva', o."nivå",
        'tema', o.tema,
        'status', o.status,
        'navn', coalesce(
          case
            when o.type in ('synonym', 'antonym') then o.innhold->>'ord'
            else o.innhold->>'tittel'
          end,
          ''
        )
      ) as oppgave
    from public.oppgaver o
    where o.ferdighet = 'lesing'
      and o.type in (
        'pastand_korrekt', 'fyll_inn', 'synonym', 'antonym', 'rekkefolge'
      )
  ) as rad;

  return v_rader;
end;
$$;

create or replace function public.redaktor_hent(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_rad jsonb;
begin
  perform public.krev_redaktor();

  select jsonb_build_object(
    'id', o.id,
    'type', o.type,
    'niva', o."nivå",
    'tema', o.tema,
    'status', o.status,
    'innhold', o.innhold
  )
    into v_rad
  from public.oppgaver o
  where o.id = p_id
    and o.ferdighet = 'lesing'
    and o.type in (
      'pastand_korrekt', 'fyll_inn', 'synonym', 'antonym', 'rekkefolge'
    );

  if v_rad is null then
    raise exception 'oppgave_ikke_funnet' using errcode = 'P0001';
  end if;

  return v_rad;
end;
$$;

create or replace function public.redaktor_lagre(
  p_id uuid,
  p_type text,
  p_niva text,
  p_tema text,
  p_innhold jsonb,
  p_status text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_innhold jsonb;
  v_tema text := nullif(btrim(coalesce(p_tema, '')), '');
  v_eksisterende public.oppgaver%rowtype;
  v_id uuid;
begin
  perform public.krev_redaktor();

  if p_type not in (
       'pastand_korrekt', 'fyll_inn', 'synonym', 'antonym', 'rekkefolge'
     )
     or p_niva not in ('A1', 'A2', 'B1', 'B2')
     or p_status not in ('kladd', 'publisert')
  then
    raise exception 'ugyldig_innhold' using errcode = 'P0001';
  end if;

  v_innhold := public.valider_lese_innhold(p_type, p_innhold);

  if p_id is null then
    insert into public.oppgaver (
      type, ferdighet, "nivå", tema, kilde, status,
      kvalitetssjekket, innhold, opprettet_av
    ) values (
      p_type,
      'lesing',
      p_niva,
      v_tema,
      'autentisk',
      p_status,
      p_status = 'publisert',
      v_innhold,
      v_uid
    )
    returning id into v_id;

    return v_id;
  end if;

  select * into v_eksisterende
  from public.oppgaver
  where id = p_id;

  if not found then
    raise exception 'oppgave_ikke_funnet' using errcode = 'P0001';
  end if;

  if v_eksisterende.type <> p_type or v_eksisterende.ferdighet <> 'lesing' then
    raise exception 'ugyldig_innhold' using errcode = 'P0001';
  end if;

  update public.oppgaver
  set "nivå" = p_niva,
      tema = v_tema,
      status = p_status,
      kvalitetssjekket = kvalitetssjekket or (p_status = 'publisert'),
      innhold = v_innhold
  where id = p_id
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.redaktor_sett_status(p_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  perform public.krev_redaktor();

  if p_status not in ('kladd', 'publisert', 'arkivert') then
    raise exception 'ugyldig_innhold' using errcode = 'P0001';
  end if;

  update public.oppgaver
  set status = p_status,
      kvalitetssjekket = kvalitetssjekket or (p_status = 'publisert')
  where id = p_id
    and ferdighet = 'lesing'
    and type in (
      'pastand_korrekt', 'fyll_inn', 'synonym', 'antonym', 'rekkefolge'
    )
  returning id into v_id;

  if v_id is null then
    raise exception 'oppgave_ikke_funnet' using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function public.er_redaktor() from public;
revoke all on function public.er_redaktor() from anon;
grant execute on function public.er_redaktor() to authenticated;

revoke all on function public.krev_redaktor() from public;
revoke all on function public.krev_redaktor() from anon;
revoke all on function public.krev_redaktor() from authenticated;

revoke all on function public.beskytt_brukerrolle() from public;
revoke all on function public.beskytt_brukerrolle() from anon;
revoke all on function public.beskytt_brukerrolle() from authenticated;

revoke all on function public.valider_lese_innhold(text, jsonb) from public;
revoke all on function public.valider_lese_innhold(text, jsonb) from anon;
revoke all on function public.valider_lese_innhold(text, jsonb) from authenticated;

revoke all on function public.redaktor_liste() from public;
revoke all on function public.redaktor_liste() from anon;
grant execute on function public.redaktor_liste() to authenticated;

revoke all on function public.redaktor_hent(uuid) from public;
revoke all on function public.redaktor_hent(uuid) from anon;
grant execute on function public.redaktor_hent(uuid) to authenticated;

revoke all on function public.redaktor_lagre(uuid, text, text, text, jsonb, text) from public;
revoke all on function public.redaktor_lagre(uuid, text, text, text, jsonb, text) from anon;
grant execute on function public.redaktor_lagre(uuid, text, text, text, jsonb, text) to authenticated;

revoke all on function public.redaktor_sett_status(uuid, text) from public;
revoke all on function public.redaktor_sett_status(uuid, text) from anon;
grant execute on function public.redaktor_sett_status(uuid, text) to authenticated;
