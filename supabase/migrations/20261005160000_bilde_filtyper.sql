-- ============================================================
-- Fase 8: png, pdf og svg i lærerens bildeoppgave
-- ============================================================
-- SVG renses i appen før lagring. PDF vises på siden.
-- Se ROADMAP.md.

alter table public.bilder
  drop constraint bilder_filnavn_format;

alter table public.bilder
  add constraint bilder_filnavn_format
  check (
    filnavn is null
    or filnavn ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|webp|svg|pdf)$'
  );

drop function public.godkjent_oppgavebilde(uuid);

create function public.godkjent_oppgavebilde(p_id uuid)
returns table (id uuid, url text, beskrivelse text, endelse text)
language sql
stable
security definer
set search_path = public
as $$
  select
    b.id,
    b.url,
    b.beskrivelse,
    case
      when b.filnavn is not null
        then substring(b.filnavn from '\.(png|webp|svg|pdf)$')
      else substring(b.url from '\.(svg|png|webp)$')
    end as endelse
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
        b.filnavn ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|webp|svg|pdf)$'
        and b.url = '/bilde/' || b.id::text
        and b.filnavn = b.id::text || '.' || substring(b.filnavn from '\.(png|webp|svg|pdf)$')
      )
    );
$$;

revoke all on function public.godkjent_oppgavebilde(uuid) from public;
revoke all on function public.godkjent_oppgavebilde(uuid) from anon;
revoke all on function public.godkjent_oppgavebilde(uuid) from authenticated;

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

  if p_id is null or p_endelse not in ('png', 'webp', 'svg', 'pdf') then
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
        else jsonb_build_object('url', b.url, 'beskrivelse', b.beskrivelse, 'endelse', b.endelse)
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
        'beskrivelse', b.beskrivelse,
        'endelse', b.endelse
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
      else jsonb_build_object('url', b.url, 'beskrivelse', b.beskrivelse, 'endelse', b.endelse)
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
      else jsonb_build_object('url', b.url, 'beskrivelse', b.beskrivelse, 'endelse', b.endelse)
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
notify pgrst, 'reload schema';
