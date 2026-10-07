-- ============================================================
-- Innsyn: svartekst og vurderingstekst på /mine-data
-- ============================================================
-- Fasit og lagringsadresse sendes ikke ut. Se ROADMAP.md.

create or replace function public.mine_svar_linjer(
  p_innhold jsonb,
  p_svar text,
  p_ferdighet text
)
returns text[]
language plpgsql
stable
set search_path = public
as $$
declare
  v_svar jsonb;
  v_elem jsonb;
  v_id text;
  v_tekst text;
  v_ja boolean;
  v_linjer text[] := '{}';
begin
  if p_ferdighet in ('skriving', 'muntlig') then
    v_tekst := nullif(btrim(coalesce(p_svar, '')), '');
    if v_tekst is null then
      return '{}';
    end if;
    return array[v_tekst];
  end if;

  begin
    v_svar := p_svar::jsonb;
  exception
    when others then
      return '{}';
  end;

  if jsonb_typeof(v_svar) <> 'object' then
    return '{}';
  end if;

  if jsonb_typeof(v_svar->'valg') = 'array' then
    for v_elem in
      select elem
      from jsonb_array_elements(coalesce(p_innhold->'pastander', '[]'::jsonb)) as t(elem)
    loop
      v_id := v_elem->>'id';
      v_tekst := nullif(btrim(coalesce(v_elem->>'tekst', '')), '');
      select (valg->>'svar') = 'true'
        into v_ja
      from jsonb_array_elements(v_svar->'valg') as v(valg)
      where valg->>'id' = v_id
      limit 1;

      if v_tekst is not null and v_ja is not null then
        v_linjer := v_linjer || (v_tekst || ' – ' || case when v_ja then 'Ja' else 'Nei' end);
      end if;
    end loop;
    return v_linjer;
  end if;

  if jsonb_typeof(v_svar->'hull') = 'array' then
    for v_elem in
      select elem
      from jsonb_array_elements(v_svar->'hull') as t(elem)
    loop
      v_tekst := nullif(btrim(coalesce(v_elem->>'svar', '')), '');
      if v_tekst is not null then
        v_linjer := v_linjer || v_tekst;
      end if;
    end loop;
    return v_linjer;
  end if;

  if nullif(btrim(coalesce(v_svar->>'valgId', '')), '') is not null then
    v_id := v_svar->>'valgId';
    select elem->>'tekst'
      into v_tekst
    from jsonb_array_elements(coalesce(p_innhold->'alternativer', '[]'::jsonb)) as t(elem)
    where elem->>'id' = v_id
    limit 1;
    v_tekst := nullif(btrim(coalesce(v_tekst, '')), '');
    if v_tekst is null then
      return '{}';
    end if;
    return array[v_tekst];
  end if;

  if jsonb_typeof(v_svar->'rekkefolge') = 'array' then
    for v_id in
      select elem
      from jsonb_array_elements_text(v_svar->'rekkefolge') as t(elem)
    loop
      select ledd->>'tekst'
        into v_tekst
      from jsonb_array_elements(coalesce(p_innhold->'ledd', '[]'::jsonb)) as t(ledd)
      where ledd->>'id' = v_id
      limit 1;
      v_tekst := nullif(btrim(coalesce(v_tekst, '')), '');
      if v_tekst is not null then
        v_linjer := v_linjer || v_tekst;
      end if;
    end loop;
    return v_linjer;
  end if;

  return '{}';
end;
$$;

create or replace function public.hent_mine_svar()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'ikke_innlogget' using errcode = 'P0001';
  end if;

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', s.id,
        'ferdighet', coalesce(o.ferdighet, ''),
        'tittel', coalesce(nullif(btrim(op.innhold->>'tittel'), ''), 'Oppgave'),
        'er_kladd', not exists (
          select 1
          from public.bruker_oppgave_historikk h
          where h.bruker_id = s.bruker_id
            and h.oppgave_id = s.oppgave_id
        ),
        'svar', to_jsonb(public.mine_svar_linjer(op.innhold, s.svar_tekst, coalesce(o.ferdighet, ''))),
        'niva', coalesce(sv.samlet_niva, mv.samlet_niva),
        'tilbakemelding', coalesce(sv.tilbakemelding_til_elev, mv.tilbakemelding_til_elev),
        'positivt', coalesce(sv.positivt_element, mv.positivt_element),
        'forbedring', coalesce(to_jsonb(sv.forbedringspunkter), to_jsonb(mv.forbedringspunkter)),
        'usikker', coalesce(sv.usikker_vurdering, mv.usikker_vurdering, false),
        'usikker_lyd', coalesce(mv.usikker_pga_lyd, false),
        'formidling_niva', mv.formidling->>'niva',
        'formidling_tekst', mv.formidling->>'begrunnelse',
        'flyt_niva', mv.sprakligekriterier->'flyt'->>'niva',
        'flyt_tekst', mv.sprakligekriterier->'flyt'->>'begrunnelse',
        'uttale_niva', mv.sprakligekriterier->'uttale'->>'niva',
        'uttale_tekst', mv.sprakligekriterier->'uttale'->>'begrunnelse',
        'ord_niva', mv.sprakligekriterier->'ordforrad'->>'niva',
        'ord_tekst', mv.sprakligekriterier->'ordforrad'->>'begrunnelse',
        'grammatikk_niva', mv.sprakligekriterier->'grammatikk'->>'niva',
        'grammatikk_tekst', mv.sprakligekriterier->'grammatikk'->>'begrunnelse',
        'larer_niva', lk.niva,
        'larer_tekst', lk.kommentar
      )
      order by s.innsendt_dato desc
    )
    from public.bruker_svar s
    join public.oppgaver op on op.id = s.oppgave_id
    left join public.okt_tilstand o
      on o.id = s.okt_id
     and o.bruker_id = v_uid
    left join public.skriftlig_vurdering sv on sv.bruker_svar_id = s.id
    left join public.muntlig_vurdering mv on mv.bruker_svar_id = s.id
    left join public.larer_kommentar lk on lk.bruker_svar_id = s.id
    where s.bruker_id = v_uid
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.mine_svar_linjer(jsonb, text, text) from public;
revoke all on function public.mine_svar_linjer(jsonb, text, text) from anon;
revoke all on function public.mine_svar_linjer(jsonb, text, text) from authenticated;

revoke all on function public.hent_mine_svar() from public;
revoke all on function public.hent_mine_svar() from anon;
grant execute on function public.hent_mine_svar() to authenticated;

notify pgrst, 'reload schema';
