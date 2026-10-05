-- ============================================================
-- Fase 8: eleven ser formidling per oppgave og språk for økten
-- ============================================================
-- Promptfilen endres ikke. Se beslutningen i ROADMAP.md.

create or replace function public.muntlig_oppgave_json(
  p_okt_id uuid,
  p_oppgave_id uuid,
  p_uid uuid
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', o.id,
    'tittel', o.innhold->>'tittel',
    'tekst', o.innhold->>'tekst',
    'oppgavetype', o.innhold->>'oppgavetype',
    'nivagruppe', o.innhold->>'nivagruppe',
    'bilde', case
      when b.url is null then null
      else jsonb_build_object(
        'url', b.url,
        'beskrivelse', b.beskrivelse,
        'endelse', b.endelse
      )
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
        'formidling', v.formidling,
        'sprakligekriterier', v.sprakligekriterier,
        'samlet_niva', v.samlet_niva,
        'forbedringspunkter', to_jsonb(v.forbedringspunkter),
        'positivt_element', v.positivt_element,
        'tilbakemelding_til_elev', v.tilbakemelding_til_elev,
        'usikker_vurdering', v.usikker_vurdering,
        'usikker_pga_lyd', v.usikker_pga_lyd
      )
    end
  )
  from public.oppgaver o
  left join lateral public.godkjent_oppgavebilde(o.bilde_id) b on true
  left join lateral (
    select s.id, s.svar_tekst, s.svar_lyd_url
    from public.bruker_svar s
    where s.okt_id = p_okt_id
      and s.oppgave_id = o.id
      and s.bruker_id = p_uid
    order by s.innsendt_dato desc
    limit 1
  ) svar on true
  left join public.muntlig_vurdering v on v.bruker_svar_id = svar.id
  left join public.larer_kommentar lk on lk.bruker_svar_id = svar.id
  where o.id = p_oppgave_id;
$$;

notify pgrst, 'reload schema';
