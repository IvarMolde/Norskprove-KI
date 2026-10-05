-- ============================================================
-- Fase 8: eleven ser svarene etter den adaptive prøven
-- ============================================================
-- Nivågruppen blir stående. Tersklene endres ikke. Se ROADMAP.md.

create or replace function public.adaptiv_gjennomgang(p_okt_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_status text;
  v_rad jsonb;
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
      and r.rettighet = 'adaptiv_prove'
  ) then
    raise exception 'mangler_adaptiv' using errcode = 'P0001';
  end if;

  select o.status
    into v_status
  from public.okt_tilstand o
  join public.prove_sesjon s on s.okt_id = o.id
  where o.id = p_okt_id
    and o.bruker_id = v_uid;

  if not found then
    raise exception 'okt_ikke_funnet' using errcode = 'P0001';
  end if;

  if v_status <> 'fullfort' then
    return '[]'::jsonb;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', t.oppgave_id,
        'tittel', t.tittel,
        'del', t.del,
        'nummer', t.nummer,
        'antall', t.antall,
        'riktig', t.riktig
      )
      order by t.rekkefolge
    ),
    '[]'::jsonb
  )
  into v_rad
  from (
    select
      oo.rekkefolge,
      o.id as oppgave_id,
      coalesce(nullif(btrim(o.innhold->>'tittel'), ''), 'Oppgave') as tittel,
      case a.fase
        when 'forprove1' then 'Del 1'
        when 'forprove2_lett' then 'Del 2'
        when 'forprove2_vanskelig' then 'Del 2'
        else 'Del 3'
      end as del,
      (row_number() over (partition by a.fase order by oo.rekkefolge))::int as nummer,
      (count(*) over (partition by a.fase))::int as antall,
      public.adaptiv_svar_er_riktig(
        o.type,
        o.innhold,
        svar.svar_tekst::jsonb
      ) as riktig
    from public.okt_oppgaver oo
    join public.oppgaver o on o.id = oo.oppgave_id
    join public.adaptiv_oppgave a on a.oppgave_id = o.id
    join lateral (
      select s.svar_tekst
      from public.bruker_svar s
      where s.okt_id = oo.okt_id
        and s.oppgave_id = o.id
        and s.bruker_id = v_uid
        and s.svar_tekst is not null
      order by s.innsendt_dato desc
      limit 1
    ) svar on true
    where oo.okt_id = p_okt_id
  ) t;

  return v_rad;
end;
$$;

revoke all on function public.adaptiv_gjennomgang(uuid) from public;
revoke all on function public.adaptiv_gjennomgang(uuid) from anon;
grant execute on function public.adaptiv_gjennomgang(uuid) to authenticated;

notify pgrst, 'reload schema';
