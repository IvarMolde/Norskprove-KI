-- Opprett alltid app-profil sammen med en ny Supabase Auth-bruker.
-- SECURITY DEFINER er nødvendig fordi auth-triggeren skriver gjennom RLS.

create or replace function public.opprett_brukerprofil()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.brukerprofil (id)
  values (new.id)
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function public.opprett_brukerprofil() from public;

drop trigger if exists opprett_brukerprofil_ved_registrering on auth.users;
create trigger opprett_brukerprofil_ved_registrering
  after insert on auth.users
  for each row execute function public.opprett_brukerprofil();

-- Backfill er idempotent og dekker brukere registrert før triggeren finnes.
insert into public.brukerprofil (id)
select id
from auth.users
on conflict (id) do nothing;
