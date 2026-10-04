-- ============================================================
-- Fase 7: slett egen konto
-- ============================================================
-- Klienten sender ingen bruker-id. Funksjonen sletter bare
-- den innloggede brukeren og data som hører til kontoen.
-- Oppgaver og bilder i banken blir liggende.
-- Se beslutningen i ROADMAP.md.

create or replace function public.slett_egen_konto()
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

  begin
    delete from public.bruker_svar where bruker_id = v_uid;
    delete from public.bruker_oppgave_historikk where bruker_id = v_uid;
    delete from public.okt_tilstand where bruker_id = v_uid;
    delete from public.betaling where bruker_id = v_uid;

    update public.oppgaver
    set opprettet_av = null
    where opprettet_av = v_uid;

    update public.bilder
    set godkjent_av = null
    where godkjent_av = v_uid;

    update public.bilder
    set opprettet_av = null
    where opprettet_av = v_uid;

    delete from auth.users where id = v_uid;
  exception
    when others then
      raise exception 'konto_ikke_slettet' using errcode = 'P0001';
  end;

  return 'slettet';
end;
$$;

revoke all on function public.slett_egen_konto() from public;
revoke all on function public.slett_egen_konto() from anon;
grant execute on function public.slett_egen_konto() to authenticated;
