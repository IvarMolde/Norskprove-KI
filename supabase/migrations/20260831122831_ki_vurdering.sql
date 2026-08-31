-- ============================================================
-- MIGRASJON 3 av 3: KI-vurdering (skriftlig + muntlig)
-- ============================================================
-- Lagrer output fra de to KI-vurderingspromptene
-- (skriveprove-vurdering-prompt.md / muntlig-vurdering-prompt.md).
--
-- Koblet til bruker_svar (migrasjon 1), IKKE til
-- bruker_oppgave_historikk - historikk-tabellen er en logg over
-- AT noe ble besvart (for bank-rotasjon), ikke et sted å henge
-- vurderingsdata på. bruker_svar er riktig kobling siden det er
-- der selve svarteksten/lydfilen faktisk ligger.
-- ============================================================

create table skriftlig_vurdering (
  id uuid primary key default gen_random_uuid(),
  bruker_svar_id uuid not null references bruker_svar(id) on delete cascade,

  -- Speiler JSON-skjemaet fra skriveprove-vurdering-prompt.md:
  -- { tekstoppbygging: {niva, begrunnelse}, rettskriving: {...}, ... }
  kriterier jsonb not null,

  samlet_niva text not null check (samlet_niva in ('Under A1', 'A1', 'A2', 'B1', 'B2')),
  forbedringspunkter text[] not null default '{}',
  positivt_element text,
  tilbakemelding_til_elev text,

  usikker_vurdering boolean not null default false,
  vurdert_dato timestamptz not null default now()
);

create table muntlig_vurdering (
  id uuid primary key default gen_random_uuid(),
  bruker_svar_id uuid not null references bruker_svar(id) on delete cascade,

  -- Speiler to-lags-strukturen fra muntlig-vurdering-prompt.md:
  -- formidling er PER OPPGAVE, sprakligekriterier er HOLISTISK
  -- (flyt/uttale/ordforrad/grammatikk) over hele økten.
  formidling jsonb not null,
  sprakligekriterier jsonb not null,

  samlet_niva text not null check (samlet_niva in ('Under A1', 'A1', 'A2', 'B1', 'B2')),
  forbedringspunkter text[] not null default '{}',
  positivt_element text,
  tilbakemelding_til_elev text,

  usikker_vurdering boolean not null default false,
  -- Eget flagg for lydbasert usikkerhet (flyt/uttale) - yngre,
  -- mindre bevist kapabilitet enn tekstbasert vurdering. Egen
  -- kolonne slik at spot-sjekk-dashbordet kan filtrere/sortere på
  -- akkurat dette skillet.
  usikker_pga_lyd boolean not null default false,
  vurdert_dato timestamptz not null default now()
);

-- Indekser for spot-sjekk-dashbordet - hentes ofte filtrert på
-- usikre vurderinger, sortert på nyeste først.
create index idx_skriftlig_vurdering_usikker on skriftlig_vurdering (usikker_vurdering, vurdert_dato desc)
  where usikker_vurdering = true;

create index idx_muntlig_vurdering_usikker on muntlig_vurdering (usikker_vurdering, vurdert_dato desc)
  where usikker_vurdering = true;

create index idx_muntlig_vurdering_usikker_lyd on muntlig_vurdering (usikker_pga_lyd, vurdert_dato desc)
  where usikker_pga_lyd = true;

alter table skriftlig_vurdering enable row level security;
alter table muntlig_vurdering enable row level security;

create policy "Bruker ser egen skriftlig vurdering"
  on skriftlig_vurdering for select using (
    exists (
      select 1 from bruker_svar s
      where s.id = bruker_svar_id and s.bruker_id = auth.uid()
    )
  );

create policy "Bruker ser egen muntlig vurdering"
  on muntlig_vurdering for select using (
    exists (
      select 1 from bruker_svar s
      where s.id = bruker_svar_id and s.bruker_id = auth.uid()
    )
  );

-- Merk: INSERT på begge tabellene skal kun skje fra backend
-- (service role), ikke fra klienten direkte - derfor ingen
-- "for all"-policy her slik som på bruker_svar. Klienten sender
-- svaret, backend kaller KI-vurderingen og skriver resultatet.