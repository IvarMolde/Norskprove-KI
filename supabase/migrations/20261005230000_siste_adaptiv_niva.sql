-- ============================================================
-- Fase 8: nivågruppen vises igjen etter den adaptive prøven
-- ============================================================
-- Lesing og lytting holdes fra hverandre. Se ROADMAP.md.

create or replace function public.siste_adaptiv_niva(p_ferdighet text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_rad jsonb;
begin
  if v_uid is null then
    raise exception 'ikke_innlogget' using errcode = 'P0001';
  end if;

  if p_ferdighet is null or p_ferdighet not in ('lesing', 'lytting') then
    raise exception 'ugyldig_ferdighet' using errcode = 'P0001';
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

  select jsonb_build_object(
    'id', o.id,
    'niva_gruppe', s.niva_gruppe_tildelt
  )
  into v_rad
  from public.prove_sesjon s
  join public.okt_tilstand o on o.id = s.okt_id
  where o.bruker_id = v_uid
    and o.ferdighet = p_ferdighet
    and s.ferdighet = p_ferdighet
    and o.status = 'fullfort'
    and s.fullfort is not null
    and s.niva_gruppe_tildelt is not null
  order by s.fullfort desc, o.startet desc
  limit 1;

  return v_rad;
end;
$$;

revoke all on function public.siste_adaptiv_niva(text) from public;
revoke all on function public.siste_adaptiv_niva(text) from anon;
grant execute on function public.siste_adaptiv_niva(text) to authenticated;

notify pgrst, 'reload schema';
