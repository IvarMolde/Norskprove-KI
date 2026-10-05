-- ============================================================
-- Fase 8: eleven hører sitt eget opptak
-- ============================================================
-- Lagringsadressen sendes ikke til nettleseren. Se ROADMAP.md.

create or replace function public.hent_egen_muntlig_lyd(
  p_okt_id uuid,
  p_oppgave_id uuid
)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_adresse text;
begin
  if v_uid is null then
    raise exception 'ikke_innlogget' using errcode = 'P0001';
  end if;

  if not exists (
    select 1
    from public.okt_tilstand o
    where o.id = p_okt_id
      and o.bruker_id = v_uid
      and o.ferdighet = 'muntlig'
  ) then
    raise exception 'okt_ikke_funnet' using errcode = 'P0001';
  end if;

  select s.svar_lyd_url
    into v_adresse
  from public.bruker_svar s
  join public.muntlig_vurdering v on v.bruker_svar_id = s.id
  where s.okt_id = p_okt_id
    and s.oppgave_id = p_oppgave_id
    and s.bruker_id = v_uid
    and s.svar_lyd_url ~ (
      '^muntlig-opptak/'
      || v_uid::text
      || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(webm|wav|mp3|ogg)$'
    );

  if v_adresse is null then
    raise exception 'mangler_lyd' using errcode = 'P0001';
  end if;

  return v_adresse;
end;
$$;

revoke all on function public.hent_egen_muntlig_lyd(uuid, uuid) from public;
revoke all on function public.hent_egen_muntlig_lyd(uuid, uuid) from anon;
grant execute on function public.hent_egen_muntlig_lyd(uuid, uuid) to authenticated;

notify pgrst, 'reload schema';
