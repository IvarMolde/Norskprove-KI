-- Håndhev sentrale innholdsregler i databasen. Klientvalidering er kun
-- brukerhjelp og skal ikke være sikkerhetsgrensen.

create or replace function public.sett_opprinnelig_bildestatus()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.kilde = 'opplastet' then
    new.status := 'venter_godkjenning';
    new.godkjent_av := null;
    new.godkjent_dato := null;
  elsif new.kilde = 'ki_generert' then
    new.status := 'godkjent';
    new.godkjent_av := null;
    new.godkjent_dato := coalesce(new.godkjent_dato, now());
  end if;

  return new;
end;
$$;

revoke all on function public.sett_opprinnelig_bildestatus() from public;

create trigger sett_opprinnelig_bildestatus
  before insert on public.bilder
  for each row execute function public.sett_opprinnelig_bildestatus();

alter table public.bilder
  add constraint bilder_ki_generert_godkjent
  check (kilde <> 'ki_generert' or status = 'godkjent')
  not valid;

alter table public.bilder
  add constraint bilder_godkjenning_har_revisjonsspor
  check (
    (
      status = 'godkjent'
      and (
        kilde = 'ki_generert'
        or (godkjent_av is not null and godkjent_dato is not null)
      )
    )
    or (
      status <> 'godkjent'
      and godkjent_av is null
      and godkjent_dato is null
    )
  )
  not valid;

alter table public.oppgaver
  add constraint oppgaver_innhold_er_objekt
  check (
    jsonb_typeof(innhold) = 'object'
    and innhold <> '{}'::jsonb
  )
  not valid;

alter table public.oppgaver
  add constraint oppgaver_publisert_er_kvalitetssjekket
  check (status <> 'publisert' or kvalitetssjekket = true)
  not valid;

create or replace function public.kontroller_publisert_oppgave()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'publisert' and new.bilde_id is not null and not exists (
    select 1
    from public.bilder
    where id = new.bilde_id
      and status = 'godkjent'
  ) then
    raise exception 'En publisert oppgave kan bare bruke et godkjent bilde'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function public.kontroller_publisert_oppgave() from public;

create trigger kontroller_publisert_oppgave
  before insert or update of status, bilde_id on public.oppgaver
  for each row execute function public.kontroller_publisert_oppgave();

create or replace function public.beskytt_bilde_i_publisert_oppgave()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'godkjent'
    and new.status <> 'godkjent'
    and exists (
      select 1
      from public.oppgaver
      where bilde_id = new.id
        and status = 'publisert'
    )
  then
    raise exception 'Bildet brukes av en publisert oppgave og kan ikke avvises'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function public.beskytt_bilde_i_publisert_oppgave() from public;

create trigger beskytt_bilde_i_publisert_oppgave
  before update of status on public.bilder
  for each row execute function public.beskytt_bilde_i_publisert_oppgave();
