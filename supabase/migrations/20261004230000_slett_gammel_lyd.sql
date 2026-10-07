-- ============================================================
-- Fase 7: slett lydadresse etter 30 dager
-- ============================================================
-- Skriftlig tekst blir liggende. Bare service_role kan kalle
-- funksjonen. Se beslutningen i ROADMAP.md.

create or replace function public.slett_gammel_lyd()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_antall int;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'ikke_innlogget' using errcode = 'P0001';
  end if;

  update public.bruker_svar
  set svar_lyd_url = null
  where svar_lyd_url is not null
    and innsendt_dato < now() - interval '30 days';

  get diagnostics v_antall = row_count;
  return v_antall;
end;
$$;

revoke all on function public.slett_gammel_lyd() from public;
revoke all on function public.slett_gammel_lyd() from anon;
revoke all on function public.slett_gammel_lyd() from authenticated;
grant execute on function public.slett_gammel_lyd() to service_role;
