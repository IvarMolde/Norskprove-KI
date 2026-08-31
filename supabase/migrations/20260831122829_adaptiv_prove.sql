-- ============================================================
-- MIGRASJON 2 av 3: Adaptiv prøve (899 kr-tieret)
-- ============================================================
-- Regelbasert forgrening, ikke ekte IRT ennå - se diskusjon i
-- samtalen. Bygger datagrunnlag for ekte kalibrering senere.
--
-- prove_sesjon er BEVISST IKKE slått sammen med okt_tilstand
-- (migrasjon 1), til tross for at det ble vurdert underveis.
-- Adaptiv-motoren har en helt annen endringstakt enn den stabile,
-- enkle pause/fortsett-logikken - å veve dem sammen ville gjort
-- fremtidig videreutvikling av adaptiv-motoren risikabel for alle
-- økter i produktet, ikke bare de adaptive. Koblet med fremmednøkkel
-- i stedet; synkronisering løses i applikasjonslaget (skriv til
-- begge tabellene i samme transaksjon).
-- ============================================================

-- Fasene er splittet på faktisk gren (lett/vanskelig forprøve 2,
-- og hvilken av de tre hovedprøvene), ikke bare et generisk
-- "forprove2"/"hovedprove" - nødvendig for at terskeltabellen skal
-- kunne uttrykke den virkelige forgreningen fra research'en vår
-- (forprøve 1 -> lett/vanskelig forprøve 2 -> én av tre hovedprøver).
create table adaptiv_terskler (
  id uuid primary key default gen_random_uuid(),
  fase text not null check (fase in (
    'forprove1', 'forprove2_lett', 'forprove2_vanskelig',
    'hovedprove_a1a2', 'hovedprove_a2b1', 'hovedprove_b1b2'
  )),
  min_poeng int not null,
  maks_poeng int not null,
  neste_fase text check (neste_fase in (
    'forprove2_lett', 'forprove2_vanskelig',
    'hovedprove_a1a2', 'hovedprove_a2b1', 'hovedprove_b1b2', 'ferdig'
  )),
  neste_niva_gruppe text check (neste_niva_gruppe in ('A1-A2', 'A2-B1', 'B1-B2'))
);

-- Startestimater basert på 7-8 oppgaver per forprøve. IKKE
-- kalibrerte tall - juster når dere har faktiske brukerdata.
-- (Ekte HK-dir-grenser er ikke offentliggjort presist, og varierer
-- forøvrig litt fra avvikling til avvikling selv for dem.)
insert into adaptiv_terskler (fase, min_poeng, maks_poeng, neste_fase, neste_niva_gruppe) values
  ('forprove1', 0, 3, 'forprove2_lett',      null),
  ('forprove1', 4, 8, 'forprove2_vanskelig', null),

  ('forprove2_lett', 0, 3, 'hovedprove_a1a2', 'A1-A2'),
  ('forprove2_lett', 4, 8, 'hovedprove_a2b1', 'A2-B1'),

  ('forprove2_vanskelig', 0, 3, 'hovedprove_a2b1', 'A2-B1'),
  ('forprove2_vanskelig', 4, 8, 'hovedprove_b1b2', 'B1-B2');

create table prove_sesjon (
  id uuid primary key default gen_random_uuid(),
  okt_id uuid not null references okt_tilstand(id) on delete cascade,
  ferdighet text not null check (ferdighet in ('lesing', 'lytting')), -- kun disse to er adaptive
  fase text not null default 'forprove1' check (fase in (
    'forprove1', 'forprove2_lett', 'forprove2_vanskelig',
    'hovedprove_a1a2', 'hovedprove_a2b1', 'hovedprove_b1b2', 'ferdig'
  )),
  poengsum_hittil int not null default 0,
  niva_gruppe_tildelt text check (niva_gruppe_tildelt in ('A1-A2', 'A2-B1', 'B1-B2')),
  startet timestamptz not null default now(),
  fullfort timestamptz
);

create index idx_prove_sesjon_okt on prove_sesjon (okt_id);

alter table prove_sesjon enable row level security;

create policy "Bruker ser og oppdaterer egen adaptiv sesjon"
  on prove_sesjon for all using (
    exists (
      select 1 from okt_tilstand o
      where o.id = okt_id and o.bruker_id = auth.uid()
    )
  );