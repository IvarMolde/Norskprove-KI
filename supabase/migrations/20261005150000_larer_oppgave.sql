-- ============================================================
-- Fase 8: lærer lager muntlig oppgave
-- ============================================================
-- Bilde kreves bare for individuell_beskrive_bilde.
-- Filen ligger i bøtten oppgave-bilder. Nettleseren får /bilde/{id}.
-- Se ROADMAP.md.

alter table public.bilder
  add column filnavn text;

alter table public.bilder
  add constraint bilder_filnavn_format
  check (
    filnavn is null
    or filnavn ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|webp)$'
  );

insert into storage.buckets (id, name, public)
values ('oppgave-bilder', 'oppgave-bilder', false)
on conflict (id) do nothing;

create or replace function public.godkjent_oppgavebilde(p_id uuid)
returns table (id uuid, url text, beskrivelse text)
language sql
stable
security definer
set search_path = public
as $$
  select b.id, b.url, b.beskrivelse
  from public.bilder b
  where b.id = p_id
    and b.status = 'godkjent'
    and nullif(btrim(b.beskrivelse), '') is not null
    and (
      (
        b.filnavn is null
        and b.url ~ '^/bilder/[a-z0-9-]+\.(svg|png|webp)$'
      )
      or (
        b.filnavn ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|webp)$'
        and b.url = '/bilde/' || b.id::text
        and b.filnavn = b.id::text || '.' || substring(b.filnavn from '\.(png|webp)$')
      )
    );
$$;

create or replace function public.krev_oppgavelarer()
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

  if not public.er_larer() then
    raise exception 'kan_ikke_lage_oppgave' using errcode = 'P0001';
  end if;
end;
$$;

create or replace function public.larer_lagre_bilde(
  p_id uuid,
  p_beskrivelse text,
  p_endelse text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tekst text := btrim(coalesce(p_beskrivelse, ''));
begin
  perform public.krev_oppgavelarer();

  if p_id is null or p_endelse not in ('png', 'webp') then
    raise exception 'ugyldig_bilde' using errcode = 'P0001';
  end if;

  if v_tekst = '' or char_length(v_tekst) > 300 then
    raise exception 'bilde_pakrevd' using errcode = 'P0001';
  end if;

  insert into public.bilder (
    id, url, beskrivelse, filnavn, kilde, status, kreditering_pakrevd, opprettet_av
  ) values (
    p_id,
    '/bilde/' || p_id::text,
    v_tekst,
    p_id::text || '.' || p_endelse,
    'opplastet',
    'godkjent',
    false,
    auth.uid()
  );

  return p_id;
end;
$$;

create or replace function public.larer_fjern_ubrukt_bilde(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.krev_oppgavelarer();

  if exists (
    select 1 from public.oppgaver o where o.bilde_id = p_id
  ) then
    return;
  end if;

  delete from public.bilder
  where id = p_id
    and filnavn is not null
    and opprettet_av = auth.uid();
end;
$$;

create or replace function public.larer_lagre_oppgave(
  p_id uuid,
  p_tittel text,
  p_tekst text,
  p_oppgavetype text,
  p_nivagruppe text,
  p_tema text,
  p_status text,
  p_bilde_id uuid,
  p_beskrivelse text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tittel text := btrim(coalesce(p_tittel, ''));
  v_tekst text := btrim(coalesce(p_tekst, ''));
  v_tema text := nullif(btrim(coalesce(p_tema, '')), '');
  v_beskrivelse text := btrim(coalesce(p_beskrivelse, ''));
  v_niva text;
  v_id uuid;
  v_eksisterende public.oppgaver%rowtype;
begin
  perform public.krev_oppgavelarer();

  if char_length(v_tittel) < 1 or char_length(v_tittel) > 120
     or char_length(v_tekst) < 1 or char_length(v_tekst) > 1000
     or (v_tema is not null and char_length(v_tema) > 40)
     or p_oppgavetype not in ('individuell_fortelle', 'individuell_beskrive_bilde')
     or p_nivagruppe not in ('A1-A2', 'A2-B1', 'B1-B2')
     or p_status not in ('kladd', 'publisert')
  then
    raise exception 'ugyldig_innhold' using errcode = 'P0001';
  end if;

  v_niva := case p_nivagruppe
    when 'A1-A2' then 'A2'
    when 'A2-B1' then 'B1'
    else 'B2'
  end;

  if p_oppgavetype = 'individuell_fortelle' then
    if p_bilde_id is not null then
      raise exception 'ugyldig_innhold' using errcode = 'P0001';
    end if;
  else
    if p_bilde_id is null
       or v_beskrivelse = ''
       or char_length(v_beskrivelse) > 300
       or not exists (select 1 from public.godkjent_oppgavebilde(p_bilde_id))
    then
      raise exception 'bilde_pakrevd' using errcode = 'P0001';
    end if;

    update public.bilder
    set beskrivelse = v_beskrivelse
    where id = p_bilde_id;
  end if;

  if p_id is null then
    insert into public.oppgaver (
      type, ferdighet, "nivå", tema, kilde, status,
      kvalitetssjekket, bilde_id, innhold, opprettet_av
    ) values (
      'muntlig_opptak',
      'muntlig',
      v_niva,
      v_tema,
      'autentisk',
      p_status,
      p_status = 'publisert',
      p_bilde_id,
      jsonb_build_object(
        'tittel', v_tittel,
        'tekst', v_tekst,
        'oppgavetype', p_oppgavetype,
        'nivagruppe', p_nivagruppe
      ),
      auth.uid()
    )
    returning id into v_id;

    return v_id;
  end if;

  select * into v_eksisterende
  from public.oppgaver
  where id = p_id
    and ferdighet = 'muntlig'
    and type = 'muntlig_opptak';

  if not found or v_eksisterende.innhold->>'oppgavetype' <> p_oppgavetype then
    raise exception 'oppgave_ikke_funnet' using errcode = 'P0001';
  end if;

  update public.oppgaver
  set "nivå" = v_niva,
      tema = v_tema,
      status = p_status,
      kvalitetssjekket = kvalitetssjekket or (p_status = 'publisert'),
      bilde_id = p_bilde_id,
      innhold = jsonb_build_object(
        'tittel', v_tittel,
        'tekst', v_tekst,
        'oppgavetype', p_oppgavetype,
        'nivagruppe', p_nivagruppe
      )
  where id = p_id
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.larer_oppgaveliste()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_rad jsonb;
begin
  perform public.krev_oppgavelarer();

  select coalesce(jsonb_agg(t.rad), '[]'::jsonb)
    into v_rad
  from (
    select jsonb_build_object(
      'id', o.id,
      'tittel', o.innhold->>'tittel',
      'oppgavetype', o.innhold->>'oppgavetype',
      'nivagruppe', o.innhold->>'nivagruppe',
      'status', o.status,
      'bilde', case
        when b.url is null then null
        else jsonb_build_object('url', b.url, 'beskrivelse', b.beskrivelse)
      end
    ) as rad
    from public.oppgaver o
    left join lateral public.godkjent_oppgavebilde(o.bilde_id) b on true
    where o.ferdighet = 'muntlig'
      and o.type = 'muntlig_opptak'
      and o.innhold->>'oppgavetype' in (
        'individuell_fortelle', 'individuell_beskrive_bilde'
      )
    order by o.opprettet_dato desc
  ) t;

  return v_rad;
end;
$$;

create or replace function public.larer_hent_oppgave(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_rad jsonb;
begin
  perform public.krev_oppgavelarer();

  select jsonb_build_object(
    'id', o.id,
    'tittel', o.innhold->>'tittel',
    'tekst', o.innhold->>'tekst',
    'oppgavetype', o.innhold->>'oppgavetype',
    'nivagruppe', o.innhold->>'nivagruppe',
    'tema', o.tema,
    'status', o.status,
    'bilde', case
      when b.url is null then null
      else jsonb_build_object(
        'id', b.id,
        'url', b.url,
        'beskrivelse', b.beskrivelse
      )
    end
  )
  into v_rad
  from public.oppgaver o
  left join lateral public.godkjent_oppgavebilde(o.bilde_id) b on true
  where o.id = p_id
    and o.ferdighet = 'muntlig'
    and o.type = 'muntlig_opptak'
    and o.innhold->>'oppgavetype' in (
      'individuell_fortelle', 'individuell_beskrive_bilde'
    );

  if v_rad is null then
    raise exception 'oppgave_ikke_funnet' using errcode = 'P0001';
  end if;

  return v_rad;
end;
$$;

create or replace function public.hent_oppgavebilde(p_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_fil text;
begin
  if auth.uid() is null then
    raise exception 'ikke_innlogget' using errcode = 'P0001';
  end if;

  select b.filnavn into v_fil
  from public.bilder b
  join public.godkjent_oppgavebilde(p_id) g on g.id = b.id
  where b.id = p_id
    and b.filnavn is not null
    and (
      public.er_larer()
      or exists (
        select 1
        from public.oppgaver o
        where o.bilde_id = p_id
          and o.status = 'publisert'
      )
    );

  if v_fil is null then
    raise exception 'bilde_mangler' using errcode = 'P0001';
  end if;

  return v_fil;
end;
$$;

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
        and exists (select 1 from public.godkjent_oppgavebilde(o.bilde_id))
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
      when b.url is null then null
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
  left join lateral public.godkjent_oppgavebilde(o.bilde_id) b on true
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
      when b.url is null then null
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
  left join lateral public.godkjent_oppgavebilde(o.bilde_id) b on true
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

revoke all on function public.godkjent_oppgavebilde(uuid) from public;
revoke all on function public.godkjent_oppgavebilde(uuid) from anon;
revoke all on function public.godkjent_oppgavebilde(uuid) from authenticated;

revoke all on function public.krev_oppgavelarer() from public;
revoke all on function public.krev_oppgavelarer() from anon;
revoke all on function public.krev_oppgavelarer() from authenticated;

revoke all on function public.larer_lagre_bilde(uuid, text, text) from public;
revoke all on function public.larer_lagre_bilde(uuid, text, text) from anon;
grant execute on function public.larer_lagre_bilde(uuid, text, text) to authenticated;

revoke all on function public.larer_fjern_ubrukt_bilde(uuid) from public;
revoke all on function public.larer_fjern_ubrukt_bilde(uuid) from anon;
grant execute on function public.larer_fjern_ubrukt_bilde(uuid) to authenticated;

revoke all on function public.larer_lagre_oppgave(uuid, text, text, text, text, text, text, uuid, text) from public;
revoke all on function public.larer_lagre_oppgave(uuid, text, text, text, text, text, text, uuid, text) from anon;
grant execute on function public.larer_lagre_oppgave(uuid, text, text, text, text, text, text, uuid, text) to authenticated;

revoke all on function public.larer_oppgaveliste() from public;
revoke all on function public.larer_oppgaveliste() from anon;
grant execute on function public.larer_oppgaveliste() to authenticated;

revoke all on function public.larer_hent_oppgave(uuid) from public;
revoke all on function public.larer_hent_oppgave(uuid) from anon;
grant execute on function public.larer_hent_oppgave(uuid) to authenticated;

revoke all on function public.hent_oppgavebilde(uuid) from public;
revoke all on function public.hent_oppgavebilde(uuid) from anon;
grant execute on function public.hent_oppgavebilde(uuid) to authenticated;

notify pgrst, 'reload schema';
