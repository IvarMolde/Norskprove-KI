-- ============================================================
-- Fase 7: rett eget nivå
-- ============================================================
-- Funksjonen endrer bare valgt_niva. Plan, rolle og alder
-- kan ikke settes her.
-- Se beslutningen i ROADMAP.md.

create or replace function public.sett_valgt_niva(p_niva text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'ikke_innlogget' using errcode = 'P0001';
  end if;

  if p_niva is null or p_niva not in ('A1', 'A2', 'B1', 'B2') then
    raise exception 'ugyldig_niva' using errcode = 'P0001';
  end if;

  update public.brukerprofil
  set valgt_niva = p_niva
  where id = v_uid;

  if not found then
    raise exception 'mangler_profil' using errcode = 'P0001';
  end if;

  return p_niva;
end;
$$;

revoke all on function public.sett_valgt_niva(text) from public;
revoke all on function public.sett_valgt_niva(text) from anon;
grant execute on function public.sett_valgt_niva(text) to authenticated;
