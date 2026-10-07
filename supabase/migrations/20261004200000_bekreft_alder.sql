-- ============================================================
-- Fase 7: alder som egenerklæring
-- ============================================================
-- Klienten kan ikke velge metode. Funksjonen setter bare
-- egenerklaert, og bare når feltet er tomt.
-- Se beslutningen i ROADMAP.md.

create or replace function public.bekreft_alder()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_metode text;
begin
  if v_uid is null then
    raise exception 'ikke_innlogget' using errcode = 'P0001';
  end if;

  select alder_bekreftet_metode into v_metode
  from public.brukerprofil
  where id = v_uid;

  if not found then
    raise exception 'mangler_profil' using errcode = 'P0001';
  end if;

  if v_metode is not null then
    return v_metode;
  end if;

  update public.brukerprofil
  set alder_bekreftet_metode = 'egenerklaert'
  where id = v_uid
    and alder_bekreftet_metode is null;

  return 'egenerklaert';
end;
$$;

revoke all on function public.bekreft_alder() from public;
revoke all on function public.bekreft_alder() from anon;
grant execute on function public.bekreft_alder() to authenticated;
